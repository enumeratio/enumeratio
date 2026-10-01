import type { Complex, ComplexFunction } from "./complex-eval.ts";
import { type Surface3dOptions, type SurfaceScene, surfaceScene, surfaceSceneSvg } from "./plot3d.ts";

// Wolfram's `ComplexPlot3D`: |f(z)| as a surface over the complex plane, each face
// coloured by arg f(z) -- the same hue wheel `notatio-complex-plot` paints, lifted into
// the third dimension. The portrait runs on the GPU one pixel at a time; a surface is a
// few thousand samples, cheap enough to take on the CPU: this samples a complex function
// (`complex-eval.ts`'s, or the GPU's grid) into a height grid and a hue grid. Pure: no
// DOM, no engine.

// --- sampling -------------------------------------------------------------------------

/** The plane to sample: `[re0, re1, im0, im1]`. */
export type ComplexDomain = readonly [number, number, number, number];

export interface ComplexSurfaceOptions {
  /** Real and imaginary extents (default `[-2, 2, -2, 2]`). */
  domain?: ComplexDomain;
  /** Samples per side, clamped to 2..400 (default 40). */
  samples?: number;
  /**
   * Height ceiling. |f| is unbounded near a pole, and one spike would flatten the rest
   * of the surface to the floor; Wolfram clips the same way (default 4).
   */
  maxHeight?: number;
}

export interface ComplexSurface {
  /** `heights[j][i]` is min(|f(z)|, maxHeight) at the (i-th re, j-th im) sample. */
  readonly heights: number[][];
  /** `hues[j][i]` is arg f(z) / 2π, in [0, 1) -- NaN where f is not finite. */
  readonly hues: number[][];
  readonly xs: number[];
  readonly ys: number[];
}

/** `[re0, re1, im0, im1]` from a `re0,re1,im0,im1` attribute, or undefined. */
export function parseComplexDomain(raw: string | undefined): ComplexDomain | undefined {
  const parts = (raw ?? "").split(",").map((s) => Number(s.trim()));
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return undefined;
  const [a, b, c, d] = parts;
  return a < b && c < d ? [a, b, c, d] : undefined;
}

/** The argument of a value as a position on the hue wheel: 0 at arg 0, ½ at arg π. */
export const hueOf = (z: Complex): number => {
  if (!Number.isFinite(z[0]) || !Number.isFinite(z[1])) return Number.NaN;
  const t = Math.atan2(z[1], z[0]) / (2 * Math.PI);
  return t < 0 ? t + 1 : t;
};

/** The sample coordinates of a domain, `samples` per side. */
export function complexGrid(opts: ComplexSurfaceOptions = {}): { xs: number[]; ys: number[] } {
  const [re0, re1, im0, im1] = opts.domain ?? [-2, 2, -2, 2];
  const n = Math.max(2, Math.min(400, Math.round(opts.samples ?? 40)));
  return {
    xs: Array.from({ length: n }, (_, i) => re0 + ((re1 - re0) * i) / (n - 1)),
    ys: Array.from({ length: n }, (_, j) => im0 + ((im1 - im0) * j) / (n - 1)),
  };
}

/**
 * Heights and hues from sampled values, row-major: `values[j * nx + i]` is `[re, im]`
 * at `(xs[i], ys[j])` -- as a flat `Float32Array` of pairs off the GPU, or a list.
 */
export function complexSurfaceOf(
  values: Float32Array | readonly Complex[],
  xs: readonly number[],
  ys: readonly number[],
  maxHeight?: number,
): ComplexSurface {
  const cap = maxHeight !== undefined && maxHeight > 0 ? maxHeight : 4;
  const nx = xs.length;
  const heights: number[][] = [];
  const hues: number[][] = [];
  for (let j = 0; j < ys.length; j++) {
    const hRow: number[] = [];
    const cRow: number[] = [];
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const w: Complex = values instanceof Float32Array ? [values[k * 2], values[k * 2 + 1]] : values[k];
      const r = Math.hypot(w[0], w[1]);
      // A pole is a real feature: keep the height, clipped, so the surface rises to the
      // ceiling around it rather than tearing a hole.
      hRow.push(Number.isNaN(r) ? Number.NaN : Math.min(r, cap));
      cRow.push(hueOf(w));
    }
    heights.push(hRow);
    hues.push(cRow);
  }
  return { heights, hues, xs: [...xs], ys: [...ys] };
}

/** Sample |f| and arg f over the domain. Never throws: a sample that blows up is NaN. */
export function sampleComplexSurface(f: ComplexFunction, opts: ComplexSurfaceOptions = {}): ComplexSurface {
  const { xs, ys } = complexGrid(opts);
  const values: Complex[] = [];
  for (const y of ys) {
    for (const x of xs) {
      try {
        values.push(f([x, y]));
      } catch {
        values.push([Number.NaN, Number.NaN]);
      }
    }
  }
  return complexSurfaceOf(values, xs, ys, opts.maxHeight);
}

// --- colouring ------------------------------------------------------------------------

/** One string per degree, so a face costs a lookup rather than a format. */
const HUES = Array.from({ length: 360 }, (_, deg) => `hsl(${deg} 75% 55%)`);

/** The face colour for a hue in [0, 1): the same wheel the portrait paints. A face with
 * no argument (a pole hit exactly) is a neutral grey -- concrete, so it paints on a
 * canvas too. */
export const hueColor = (t: number): string =>
  Number.isFinite(t) ? HUES[Math.round((((t % 1) + 1) % 1) * 360) % 360] : "hsl(0 0% 55%)";

/**
 * The hue of a face from its four corners. Arg jumps by 2π across the negative real
 * axis, so a plain mean of the corners' hues would paint every cell straddling the cut
 * with the colour opposite to both sides; averaging the unit vectors instead lands
 * between them, whichever way round they came.
 */
export function faceHue(corners: readonly number[]): number {
  let cx = 0;
  let cy = 0;
  let count = 0;
  for (const t of corners) {
    if (!Number.isFinite(t)) continue;
    cx += Math.cos(2 * Math.PI * t);
    cy += Math.sin(2 * Math.PI * t);
    count++;
  }
  if (count === 0) return Number.NaN;
  const t = Math.atan2(cy, cx) / (2 * Math.PI);
  return t < 0 ? t + 1 : t;
}

export interface ComplexSurfaceSvgOptions extends Omit<Surface3dOptions, "xs" | "ys" | "colorLegend" | "zScale"> {}

/**
 * Above this many samples a side the surface is painted on a canvas rather than
 * serialised as SVG polygons: the DOM cost of a face is what the dense grids pay for.
 */
export const CANVAS_THRESHOLD = 80;

/** The surface as a scene: heights from the grid, each face coloured by its corners' hues. */
export function complexSurfaceScene(surface: ComplexSurface, opts: ComplexSurfaceSvgOptions = {}): SurfaceScene {
  const { heights, hues, xs, ys } = surface;
  const nx = xs.length;
  // The circular mean of the corners' hues, per face, with the unit vectors taken once
  // per vertex: a dense grid asks for this tens of thousands of times a frame.
  const cx = new Float64Array(nx * ys.length);
  const cy = new Float64Array(nx * ys.length);
  hues.forEach((row, j) =>
    row.forEach((t, i) => {
      const k = j * nx + i;
      if (Number.isFinite(t)) {
        cx[k] = Math.cos(2 * Math.PI * t);
        cy[k] = Math.sin(2 * Math.PI * t);
      }
    }),
  );
  return surfaceScene([heights], {
    // Mesh lines thin out as the grid densifies, or a GPU-resolution surface is all edge.
    edgeWidth: Math.min(0.5, 30 / Math.max(nx, ys.length)),
    ...opts,
    xs,
    ys,
    fill: ({ i, j }) => {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = a + nx;
      const x = cx[a] + cx[b] + cx[c] + cx[d];
      const y = cy[a] + cy[b] + cy[c] + cy[d];
      if (x === 0 && y === 0) return hueColor(Number.NaN);
      const t = Math.atan2(y, x) / (2 * Math.PI);
      return hueColor(t < 0 ? t + 1 : t);
    },
  });
}

/** The surface as SVG. */
export function complexSurfaceSvg(surface: ComplexSurface, opts: ComplexSurfaceSvgOptions = {}): string {
  return surfaceSceneSvg(complexSurfaceScene(surface, opts));
}
