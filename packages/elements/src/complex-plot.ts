/// <reference types="@webgpu/types" />
import { type ComplexWGSL, MAX_SLOTS, zetaWGSL } from "@enumeratio/analytic/src";

// WebGPU domain-coloring of a complex-valued expression: one fragment-shader
// invocation per pixel, hue = arg, brightness = a compressed log-magnitude.
//
// Internal to the element -- deliberately not re-exported from the package index, since
// its signatures name types from `@enumeratio/analytic/src` and pulling those into the
// public .d.ts makes the declaration build resolve a second package's source tree.
//
// The point of the split from `notatio-complex-plot.ts` is the pipeline cache. A
// Manipulate slider changes a *literal* in the expression, not its shape, and
// `emitComplexWGSL` hoists literals into uniform slots precisely so that case can
// re-upload 256 bytes instead of rebuilding a shader module. `setExpression` returns
// whether it had to rebuild, which is also what makes a frame-rate readout honest.

/** Colouring from (direction, ln|value|) — see `clogPolar` / `polygammaLog`. */
const HOST = /* wgsl */ `
struct Prm {
  center : vec2f,
  res    : vec2f,
  extent : f32,
  mask   : f32,
  _pad   : vec2f,
  p      : array<vec4f, ${MAX_SLOTS}>,
};
@group(0) @binding(0) var<uniform> prm : Prm;

fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3f {
  let k = vec3f(5.0, 3.0, 1.0);
  let q = abs(fract(vec3f(h) + k / 6.0) * 6.0 - 3.0);
  return v * mix(vec3f(1.0), clamp(q - 1.0, vec3f(0.0), vec3f(1.0)), s);
}
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var q = array<vec2f, 3>(vec2f(-1.0, -3.0), vec2f(-1.0, 1.0), vec2f(3.0, 1.0));
  return vec4f(q[i], 0.0, 1.0);
}
@fragment fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  var uv = frag.xy / prm.res;
  uv.y = 1.0 - uv.y;
  let asp = prm.res.x / prm.res.y;
  let z = prm.center + (uv - vec2f(0.5)) * vec2f(prm.extent * asp, prm.extent);
  // mask > 0 dims everything outside |z| < mask: the disk of convergence for a
  // series that has one, drawn as a faint grid so the boundary still reads.
  if (prm.mask > 0.0 && dot(z, z) >= prm.mask * prm.mask) {
    let g = 0.05 + 0.03 * step(0.5, fract(z.x * 4.0)) * step(0.5, fract(z.y * 4.0));
    return vec4f(vec3f(g), 1.0);
  }
  let polar = VALUE;
  let logMag = polar.z;
  if (!(logMag < 1e30)) { return vec4f(1.0, 1.0, 1.0, 1.0); } // a pole
  if (!(logMag > -1e30)) { return vec4f(0.0, 0.0, 0.0, 1.0); } // a zero
  let hue = atan2(polar.y, polar.x) * 0.15915494 + 0.5;
  let bands = fract(logMag * 1.442695); // log2|v|
  let base = 1.0 / (1.0 + exp(-logMag)); // = |v| / (1 + |v|)
  let val = clamp(mix(base * 0.9, 1.0, 0.22 * bands), 0.0, 1.0);
  let sat = mix(1.0, 0.82, 0.18 * bands);
  return vec4f(pow(hsv2rgb(hue, sat, val), vec3f(0.9)), 1.0);
}
`;

/** The complete domain-colouring shader for a complex-valued WGSL expression `code`. */
export const portraitShader = (code: string): string =>
  `${zetaWGSL}\n${HOST.replace("VALUE", `clogPolar(${code})`)}`;

/** Bytes before the literal slots: center, res, extent, mask, pad. */
const SLOTS_OFFSET = 32;
const UNIFORM_SIZE = SLOTS_OFFSET + MAX_SLOTS * 16;

export interface ComplexPlotView {
  center: [number, number];
  extent: number;
  /** Radius outside which to dim, or 0 for the whole plane. */
  mask: number;
}

/**
 * Zoom about a point rather than the centre. `ux`/`uy` are the pointer's position in
 * [-0.5, 0.5] of the viewport with y up; `factor` scales the extent.
 *
 * The world point under the cursor sits at `center + u·E`, and it has to still sit
 * there afterwards — so the centre absorbs the whole change in extent:
 * `center += u·(E_before − E_after)`. Getting that sign backwards zooms *away* from
 * the cursor, which feels like the image running from you.
 */
export function zoomAbout(
  view: ComplexPlotView,
  ux: number,
  uy: number,
  aspect: number,
  factor: number,
  limits: { min: number; max: number } = { min: 0.05, max: 64 },
): ComplexPlotView {
  const after = Math.min(limits.max, Math.max(limits.min, view.extent * factor));
  const shrink = view.extent - after;
  return {
    center: [view.center[0] + ux * shrink * aspect, view.center[1] + uy * shrink],
    extent: after,
    mask: view.mask,
  };
}

let devicePromise: Promise<GPUDevice | null> | undefined;

/** The shared WebGPU device, or null where WebGPU is unavailable. */
export function getComplexPlotDevice(): Promise<GPUDevice | null> {
  devicePromise ??= (async () => {
    const gpu = (navigator as unknown as { gpu?: GPU }).gpu;
    if (!gpu) return null;
    const adapter = await gpu.requestAdapter();
    return adapter ? await adapter.requestDevice() : null;
  })().catch(() => null);
  return devicePromise;
}

export class ComplexPlotRenderer {
  #device: GPUDevice;
  #ctx: GPUCanvasContext;
  #format: GPUTextureFormat;
  #uniform: GPUBuffer;
  #pipelines = new Map<string, GPURenderPipeline>();
  #pipeline: GPURenderPipeline | undefined;
  #bind: GPUBindGroup | undefined;
  #literals: readonly (readonly [number, number])[] = [];
  #buf = new ArrayBuffer(UNIFORM_SIZE);

  constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
    this.#device = device;
    this.#format = (navigator as unknown as { gpu: GPU }).gpu.getPreferredCanvasFormat();
    this.#ctx = canvas.getContext("webgpu") as GPUCanvasContext;
    this.#ctx.configure({ device, format: this.#format, alphaMode: "opaque" });
    this.#uniform = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  /**
   * Point the renderer at an emitted expression. Returns "rebuilt" when the shape
   * changed and a pipeline had to be compiled, "slots" when only the literals moved
   * (the cheap path a slider takes), or "failed" if the shader would not compile.
   */
  async setExpression(e: ComplexWGSL): Promise<"rebuilt" | "slots" | "failed"> {
    this.#literals = e.literals;
    const cached = this.#pipelines.get(e.shape);
    if (cached) {
      const rebuilt = cached !== this.#pipeline;
      this.#use(cached);
      return rebuilt ? "rebuilt" : "slots";
    }
    const code = portraitShader(e.code);
    this.#device.pushErrorScope("validation");
    const module = this.#device.createShaderModule({ code });
    const pipeline = this.#device.createRenderPipeline({
      layout: "auto",
      vertex: { module, entryPoint: "vs" },
      fragment: { module, entryPoint: "fs", targets: [{ format: this.#format }] },
      primitive: { topology: "triangle-list" },
    });
    if (await this.#device.popErrorScope()) return "failed";
    this.#pipelines.set(e.shape, pipeline);
    this.#use(pipeline);
    return "rebuilt";
  }

  #use(pipeline: GPURenderPipeline): void {
    this.#pipeline = pipeline;
    this.#bind = this.#device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.#uniform } }],
    });
  }

  /** Draw one frame. Returns the GPU-submit duration in ms (a coarse cost signal). */
  render(view: ComplexPlotView, width: number, height: number): number {
    const pipeline = this.#pipeline;
    const bind = this.#bind;
    if (!pipeline || !bind) return 0;
    const t0 = performance.now();

    const f = new Float32Array(this.#buf);
    f[0] = view.center[0];
    f[1] = view.center[1];
    f[2] = width;
    f[3] = height;
    f[4] = view.extent;
    f[5] = view.mask;
    for (const [i, [re, im]] of this.#literals.entries()) {
      f[SLOTS_OFFSET / 4 + i * 4] = re;
      f[SLOTS_OFFSET / 4 + i * 4 + 1] = im;
    }
    this.#device.queue.writeBuffer(this.#uniform, 0, this.#buf);

    const enc = this.#device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [
        {
          view: this.#ctx.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bind);
    pass.draw(3);
    pass.end();
    this.#device.queue.submit([enc.finish()]);
    return performance.now() - t0;
  }
}
