/// <reference types="@webgpu/types" />
import type { BoxedExpression } from "@cortex-js/compute-engine";
import { WGSLTarget } from "@cortex-js/compute-engine/compile";
import { type ComplexWGSL, MAX_SLOTS, zetaWGSL } from "@enumeratio/analytic/src";

// Opt-in GPU evaluation of a plot grid: compile the plotted expression to a WGSL
// function via compute-engine's WGSL target (special-function heads emit calls into
// `zetaWGSL`), then run one compute-shader invocation per grid point. Real-scalar,
// matching the CPU sampler. Returns `undefined` when WebGPU is unavailable or the
// expression can't be compiled, so callers fall back to the CPU path.

let devicePromise: Promise<GPUDevice | null> | undefined;

function getDevice(): Promise<GPUDevice | null> {
  devicePromise ??= (async () => {
    const gpu = navigator.gpu;
    if (!gpu) return null;
    const adapter = await gpu.requestAdapter();
    return adapter ? adapter.requestDevice() : null;
  })().catch(() => null);
  return devicePromise;
}

/**
 * Compile a bivariate expression to a WGSL `__f(vx, vy) -> f32` function, or return
 * undefined if the WGSL target can't emit it. `zetaWGSL` is prepended so HurwitzZeta
 * / Zeta calls resolve (harmless when unused).
 */
export function toWgslFn(expr: BoxedExpression, vx: string, vy: string): string | undefined {
  try {
    const r = new WGSLTarget().compile(expr) as { success?: boolean; code?: string };
    if (!r?.success || !r.code) return undefined;
    return `${zetaWGSL}\nfn plotFn(${vx}: f32, ${vy}: f32) -> f32 { return ${r.code}; }`;
  } catch {
    return undefined;
  }
}

const TAIL = `
@group(0) @binding(0) var<storage, read_write> outp : array<f32>;
struct Params { nx: u32, ny: u32, x0: f32, y0: f32, dx: f32, dy: f32, pad0: u32, pad1: u32 };
@group(0) @binding(1) var<uniform> prm : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (gid.x >= prm.nx || gid.y >= prm.ny) { return; }
  let xv = prm.x0 + f32(gid.x) * prm.dx;
  let yv = prm.y0 + f32(gid.y) * prm.dy;
  outp[gid.y * prm.nx + gid.x] = plotFn(xv, yv);
}
`;

/** The complete compute shader for a `plotFn` unit: one invocation per grid point. */
export const computeShader = (fnCode: string): string => fnCode + TAIL;

const pipelineCache = new Map<string, GPUComputePipeline>();

/**
 * Evaluate `fnCode`'s `__f` over the (uniformly spaced) grid xs × ys on the GPU.
 * `grid[j][i]` is the value at (xs[i], ys[j]); undefined if WebGPU is unavailable or
 * the shader fails to compile.
 */
export async function evalGridGPU(
  fnCode: string,
  xs: readonly number[],
  ys: readonly number[],
): Promise<number[][] | undefined> {
  const device = await getDevice();
  if (!device) return undefined;
  const nx = xs.length;
  const ny = ys.length;
  if (nx < 1 || ny < 1) return undefined;

  const code = computeShader(fnCode);
  let pipeline = pipelineCache.get(code);
  if (!pipeline) {
    device.pushErrorScope("validation");
    const module = device.createShaderModule({ code });
    pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module, entryPoint: "main" },
    });
    if (await device.popErrorScope()) return undefined; // shader didn't compile
    pipelineCache.set(code, pipeline);
  }

  const count = nx * ny;
  const outBuf = device.createBuffer({
    size: count * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const readBuf = device.createBuffer({
    size: count * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const paramBuf = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const ab = new ArrayBuffer(32);
  new Uint32Array(ab, 0, 2).set([nx, ny]);
  new Float32Array(ab, 8, 4).set([
    xs[0],
    ys[0],
    nx > 1 ? (xs[nx - 1] - xs[0]) / (nx - 1) : 0,
    ny > 1 ? (ys[ny - 1] - ys[0]) / (ny - 1) : 0,
  ]);
  device.queue.writeBuffer(paramBuf, 0, ab);

  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: outBuf } },
      { binding: 1, resource: { buffer: paramBuf } },
    ],
  });

  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bind);
  pass.dispatchWorkgroups(Math.ceil(nx / 8), Math.ceil(ny / 8));
  pass.end();
  enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, count * 4);
  device.queue.submit([enc.finish()]);

  await readBuf.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(readBuf.getMappedRange().slice(0));
  readBuf.unmap();
  outBuf.destroy();
  readBuf.destroy();
  paramBuf.destroy();

  const grid: number[][] = [];
  for (let j = 0; j < ny; j++) grid.push(Array.from(data.subarray(j * nx, (j + 1) * nx)));
  return grid;
}

// --- complex grids ---------------------------------------------------------------------
//
// The same dispatch over an `emitComplexWGSL` expression: one invocation per grid point,
// each writing the complex value at `z` as a vec2f. The emitted code reads its literals
// from `prm.p`, as the portrait shader does, and names the point by the plot variable.

const COMPLEX_TAIL = (variable: string, code: string): string => `
struct Params {
  nx: u32, ny: u32, x0: f32, y0: f32, dx: f32, dy: f32, pad0: u32, pad1: u32,
  p: array<vec4f, ${MAX_SLOTS}>,
};
@group(0) @binding(0) var<storage, read_write> outp : array<vec2f>;
@group(0) @binding(1) var<uniform> prm : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3u) {
  if (gid.x >= prm.nx || gid.y >= prm.ny) { return; }
  let ${variable} = vec2f(prm.x0 + f32(gid.x) * prm.dx, prm.y0 + f32(gid.y) * prm.dy);
  outp[gid.y * prm.nx + gid.x] = ${code};
}
`;

/** The complete compute shader for a complex expression over `variable`. */
export const complexComputeShader = (variable: string, code: string): string =>
  `${zetaWGSL}\n${COMPLEX_TAIL(variable, code)}`;

/** Bytes before the literal slots: the grid parameters. */
const COMPLEX_PARAMS_OFFSET = 32;

/**
 * Evaluate an emitted complex expression over the grid xs × ys on the GPU. Returns the
 * values as `[re, im]` per point, row-major (`values[j * nx + i]` is at `(xs[i], ys[j])`),
 * or undefined if WebGPU is unavailable or the shader fails to compile. The pipeline is
 * cached on the expression's shape, so a literal moving costs an upload, not a rebuild.
 */
export async function evalComplexGridGPU(
  emitted: ComplexWGSL,
  variable: string,
  xs: readonly number[],
  ys: readonly number[],
): Promise<Float32Array | undefined> {
  const device = await getDevice();
  if (!device) return undefined;
  const nx = xs.length;
  const ny = ys.length;
  if (nx < 1 || ny < 1) return undefined;

  const code = complexComputeShader(variable, emitted.code);
  let pipeline = pipelineCache.get(code);
  if (!pipeline) {
    device.pushErrorScope("validation");
    const module = device.createShaderModule({ code });
    pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module, entryPoint: "main" },
    });
    if (await device.popErrorScope()) return undefined;
    pipelineCache.set(code, pipeline);
  }

  const count = nx * ny;
  const bytes = count * 8;
  const outBuf = device.createBuffer({
    size: bytes,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const readBuf = device.createBuffer({
    size: bytes,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const paramSize = COMPLEX_PARAMS_OFFSET + MAX_SLOTS * 16;
  const paramBuf = device.createBuffer({
    size: paramSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const ab = new ArrayBuffer(paramSize);
  new Uint32Array(ab, 0, 2).set([nx, ny]);
  new Float32Array(ab, 8, 4).set([
    xs[0],
    ys[0],
    nx > 1 ? (xs[nx - 1] - xs[0]) / (nx - 1) : 0,
    ny > 1 ? (ys[ny - 1] - ys[0]) / (ny - 1) : 0,
  ]);
  const slots = new Float32Array(ab, COMPLEX_PARAMS_OFFSET);
  for (const [i, [re, im]] of emitted.literals.entries()) {
    slots[i * 4] = re;
    slots[i * 4 + 1] = im;
  }
  device.queue.writeBuffer(paramBuf, 0, ab);

  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: outBuf } },
      { binding: 1, resource: { buffer: paramBuf } },
    ],
  });

  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bind);
  pass.dispatchWorkgroups(Math.ceil(nx / 8), Math.ceil(ny / 8));
  pass.end();
  enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, bytes);
  device.queue.submit([enc.finish()]);

  await readBuf.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(readBuf.getMappedRange().slice(0));
  readBuf.unmap();
  outBuf.destroy();
  readBuf.destroy();
  paramBuf.destroy();
  return data;
}
