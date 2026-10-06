/// <reference types="@webgpu/types" />
import { zetaWGSL } from "@enumeratio/analytic/shader";
import { type ComplexWGSL, MAX_SLOTS } from "@enumeratio/ce-patches/wgsl-complex";
import {
  DEFAULT_PHASE_GRADIENT,
  type Gradient,
  gradientNamed,
  hexToRgb,
  rgbToOklab,
  sampleGradient,
} from "./palettes.ts";

// WebGPU domain-coloring of a complex-valued expression: one fragment-shader
// invocation per pixel, color = arg on a gradient, brightness = a compressed log-magnitude.
//
// Internal to the element -- deliberately not re-exported from the package index, since
// its signatures name types from `@enumeratio/analytic` and pulling those into the
// public .d.ts makes the declaration build resolve a second package's source tree.
//
// The point of the split from `notatio-complex-plot.ts` is the pipeline cache. A
// Manipulate slider changes a *literal* in the expression, not its shape, and
// `emitComplexWGSL` hoists literals into uniform slots precisely so that case can
// re-upload 256 bytes instead of rebuilding a shader module. `setExpression` returns
// whether it had to rebuild, which is also what makes a frame-rate readout honest.

/** Most stops a gradient carries into the shader; a longer one is resampled to this many. */
export const MAX_STOPS = 16;

/** Coloring from (direction, ln|value|) — see `clogPolar` / `polygammaLog`. */
const HOST = /* wgsl */ `
struct Prm {
  center : vec2f,
  res    : vec2f,
  extent : f32,
  mask   : f32,
  _pad   : vec2f,
  p      : array<vec4f, ${MAX_SLOTS}>,
  // The gradient: each stop is its color (sRGB, or OKLab) and its position; ramp is
  // (stop count, 1 when the stops blend in OKLab, 1 when the gradient wraps, unused).
  stops  : array<vec4f, ${MAX_STOPS}>,
  ramp   : vec4f,
};
@group(0) @binding(0) var<uniform> prm : Prm;

fn oklab2rgb(c: vec3f) -> vec3f {
  let l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  let m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  let s = c.x - 0.0894841775 * c.y - 1.291485548 * c.z;
  let lin = max(vec3f(
    4.0767416621 * l * l * l - 3.3077115913 * m * m * m + 0.2309699292 * s * s * s,
    -1.2684380046 * l * l * l + 2.6097574011 * m * m * m - 0.3413193965 * s * s * s,
    -0.0041960863 * l * l * l - 0.7034186147 * m * m * m + 1.707614701 * s * s * s), vec3f(0.0));
  let gamma = select(1.055 * pow(lin, vec3f(1.0 / 2.4)) - 0.055, 12.92 * lin, lin <= vec3f(0.0031308));
  return clamp(gamma, vec3f(0.0), vec3f(1.0));
}

// The gradient at t, blended between its two neighboring stops as palettes.ts does.
fn gradient(t0: f32) -> vec3f {
  let n = u32(prm.ramp.x);
  var t = clamp(t0, 0.0, 1.0);
  if (prm.ramp.z > 0.5) { t = fract(t0); }
  var k = 1u;
  while (k < n - 1u && prm.stops[k].w < t) { k = k + 1u; }
  let a = prm.stops[k - 1u];
  let b = prm.stops[k];
  let f = clamp((t - a.w) / max(b.w - a.w, 1e-6), 0.0, 1.0);
  let c = mix(a.xyz, b.xyz, f);
  if (prm.ramp.y > 0.5) { return oklab2rgb(c); }
  return clamp(c, vec3f(0.0), vec3f(1.0));
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
  // arg/2π along the gradient: on the phase wheel, red on the positive reals, as ComplexPlot3D.
  let hue = fract(atan2(polar.y, polar.x) * 0.15915494);
  let bands = fract(logMag * 1.442695); // log2|v|
  let base = 1.0 / (1.0 + exp(-logMag)); // = |v| / (1 + |v|)
  let val = clamp(mix(base * 0.9, 1.0, 0.22 * bands), 0.0, 1.0);
  let sat = mix(1.0, 0.82, 0.18 * bands);
  return vec4f(pow(val * mix(vec3f(1.0), gradient(hue), sat), vec3f(0.9)), 1.0);
}
`;

/** The complete domain-coloring shader for a complex-valued WGSL expression `code`. */
export const portraitShader = (code: string): string => `${zetaWGSL}\n${HOST.replace("VALUE", `clogPolar(${code})`)}`;

/** Bytes before the literal slots: center, res, extent, mask, pad. */
const SLOTS_OFFSET = 32;
const STOPS_OFFSET = SLOTS_OFFSET + MAX_SLOTS * 16;
const RAMP_OFFSET = STOPS_OFFSET + MAX_STOPS * 16;
const UNIFORM_SIZE = RAMP_OFFSET + 16;

/**
 * A gradient as the shader reads it: `MAX_STOPS` stops of (color, position), then
 * (count, OKLab, cyclic, unused). Stops blend in the gradient's own space, so an OKLab
 * gradient's stops are uploaded as OKLab and the shader converts the blend back.
 */
export function gradientUniform(g: Gradient): Float32Array {
  const stops =
    g.stops.length <= MAX_STOPS
      ? g.stops
      : Array.from({ length: MAX_STOPS }, (_, k) => ({
          at: k / (MAX_STOPS - 1),
          color: sampleGradient(g, k / (MAX_STOPS - 1)),
        }));
  const oklab = g.space === "oklab" && g.stops.length <= MAX_STOPS;
  const out = new Float32Array(MAX_STOPS * 4 + 4);
  stops.forEach(({ at, color }, k) => {
    const rgb = hexToRgb(color);
    out.set([...(oklab ? rgbToOklab(rgb) : rgb), at], k * 4);
  });
  out.set([stops.length, oklab ? 1 : 0, g.cyclic ? 1 : 0, 0], MAX_STOPS * 4);
  return out;
}

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
  #gradient: Gradient | undefined;

  constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
    this.#device = device;
    this.#format = (navigator as unknown as { gpu: GPU }).gpu.getPreferredCanvasFormat();
    this.#ctx = canvas.getContext("webgpu") as GPUCanvasContext;
    this.#ctx.configure({ device, format: this.#format, alphaMode: "opaque" });
    this.#uniform = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.setGradient(gradientNamed(DEFAULT_PHASE_GRADIENT));
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

  /** The gradient the argument is colored with; takes effect on the next frame. */
  setGradient(g: Gradient): void {
    if (g === this.#gradient) return;
    this.#gradient = g;
    const u = gradientUniform(g);
    new Float32Array(this.#buf, STOPS_OFFSET, u.length).set(u);
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
