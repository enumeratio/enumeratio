import {
  digamma,
  hurwitzZeta,
  lerchPhi,
  logGamma,
  polygamma,
  polyLog,
  zetaGeneralized,
} from "@enumeratio/analytic/src";
import { type Surface3dOptions, surfaceSvg } from "./plot3d.ts";

// Wolfram's `ComplexPlot3D`: |f(z)| as a surface over the complex plane, each face
// coloured by arg f(z) -- the same hue wheel `notatio-complex-plot` paints, lifted into
// the third dimension. The portrait runs on the GPU one pixel at a time; a surface is a
// few thousand samples, cheap enough to take on the CPU, so this is a small complex
// evaluator over MathJSON (the same head set `emitComplexWGSL` lowers, plus Gamma) and
// a sampler that turns it into a height grid and a hue grid. Pure: no DOM, no engine.

/** A complex number as `[re, im]`. */
export type Complex = readonly [number, number];

export type ComplexFunction = (z: Complex) => Complex;

/** MathJSON, in the canonical plain-array form `ce.box(expr).json` returns. */
type Json = number | string | boolean | { [k: string]: unknown } | Json[];

// --- the field, on tuples ---------------------------------------------------------------

const add = (a: Complex, b: Complex): Complex => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Complex, b: Complex): Complex => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Complex, b: Complex): Complex => [
  a[0] * b[0] - a[1] * b[1],
  a[0] * b[1] + a[1] * b[0],
];
const div = (a: Complex, b: Complex): Complex => {
  const d = b[0] * b[0] + b[1] * b[1];
  // A pole hit exactly: infinite, with no argument -- not the 0/0 NaN that would read
  // as "undefined here" and tear a hole where the surface should spike.
  if (d === 0) return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const exp = (z: Complex): Complex => {
  const r = Math.exp(z[0]);
  return [r * Math.cos(z[1]), r * Math.sin(z[1])];
};
/** Principal branch, cut along the negative real axis. */
const log = (z: Complex): Complex => [Math.log(Math.hypot(z[0], z[1])), Math.atan2(z[1], z[0])];
const pow = (z: Complex, w: Complex): Complex => {
  if (z[0] === 0 && z[1] === 0) return w[0] > 0 ? [0, 0] : [Number.NaN, Number.NaN];
  return exp(mul(w, log(z)));
};
const sin = (z: Complex): Complex => [
  Math.sin(z[0]) * Math.cosh(z[1]),
  Math.cos(z[0]) * Math.sinh(z[1]),
];
const cos = (z: Complex): Complex => [
  Math.cos(z[0]) * Math.cosh(z[1]),
  -Math.sin(z[0]) * Math.sinh(z[1]),
];
const sinh = (z: Complex): Complex => [
  Math.sinh(z[0]) * Math.cos(z[1]),
  Math.cosh(z[0]) * Math.sin(z[1]),
];
const cosh = (z: Complex): Complex => [
  Math.cosh(z[0]) * Math.cos(z[1]),
  Math.sinh(z[0]) * Math.sin(z[1]),
];
const sqrt = (z: Complex): Complex => pow(z, [0.5, 0]);

type Cx = { re: number; im: number };
const toCx = (z: Complex): Cx => ({ re: z[0], im: z[1] });
const ofCx = (c: Cx): Complex => [c.re, c.im];

const UNARY: Record<string, (z: Complex) => Complex> = {
  Exp: exp,
  Ln: log,
  Log: log,
  Sqrt: sqrt,
  Sin: sin,
  Cos: cos,
  Tan: (z) => div(sin(z), cos(z)),
  Sinh: sinh,
  Cosh: cosh,
  Tanh: (z) => div(sinh(z), cosh(z)),
  Negate: (z) => [-z[0], -z[1]],
  Conjugate: (z) => [z[0], -z[1]],
  Abs: (z) => [Math.hypot(z[0], z[1]), 0],
  Re: (z) => [z[0], 0],
  Im: (z) => [z[1], 0],
  Square: (z) => mul(z, z),
  Gamma: (z) => exp(ofCx(logGamma(toCx(z)))),
  LogGamma: (z) => ofCx(logGamma(toCx(z))),
  Digamma: (z) => ofCx(digamma(toCx(z))),
};

const CONSTANTS: Record<string, Complex> = {
  Pi: [Math.PI, 0],
  ExponentialE: [Math.E, 0],
  ImaginaryUnit: [0, 1],
  EulerGamma: [0.5772156649015329, 0],
  GoldenRatio: [(1 + Math.sqrt(5)) / 2, 0],
  CatalanConstant: [0.915965594177219, 0],
};

const symbolOf = (j: Json): string | undefined => {
  if (typeof j === "string") return j;
  if (typeof j === "object" && j !== null && !Array.isArray(j)) {
    const sym = (j as { sym?: unknown }).sym;
    if (typeof sym === "string") return sym;
  }
  return undefined;
};

const numberOf = (j: Json): number | undefined => {
  if (typeof j === "number") return j;
  if (Array.isArray(j) && j.length === 3 && symbolOf(j[0] as Json) === "Rational") {
    const p = numberOf(j[1] as Json);
    const q = numberOf(j[2] as Json);
    return p !== undefined && q !== undefined && q !== 0 ? p / q : undefined;
  }
  if (typeof j === "object" && j !== null && !Array.isArray(j)) {
    const num = (j as { num?: unknown }).num;
    if (typeof num === "string") {
      const v = Number(num.replace(/_/g, ""));
      return Number.isFinite(v) ? v : undefined;
    }
  }
  return undefined;
};

/** `ln` -> `Ln`: a round trip through notatio can hand back a lowercase head. */
const capitalize = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

class Unsupported extends Error {}

function compile(j: Json, variable: string): ComplexFunction {
  const n = numberOf(j);
  if (n !== undefined) return () => [n, 0];
  const sym = symbolOf(j);
  if (sym !== undefined) {
    if (sym === variable) return (z) => z;
    const k = CONSTANTS[sym];
    if (k) return () => k;
    throw new Unsupported(`unbound symbol ${sym}`);
  }
  if (!Array.isArray(j)) throw new Unsupported("unsupported node");
  const head = symbolOf(j[0] as Json);
  if (head === undefined) throw new Unsupported("unsupported node");
  const args = j.slice(1) as Json[];
  if (head === "Complex" && args.length === 2) {
    const re = numberOf(args[0]);
    const im = numberOf(args[1]);
    if (re === undefined || im === undefined) throw new Unsupported("non-literal Complex");
    return () => [re, im];
  }
  const fs = args.map((a) => compile(a, variable));
  const f = (i: number): ComplexFunction => fs[i];
  switch (head) {
    case "Add":
      if (fs.length >= 2) return (z) => fs.reduce<Complex>((acc, g) => add(acc, g(z)), [0, 0]);
      break;
    case "Subtract":
      if (fs.length === 2) return (z) => sub(f(0)(z), f(1)(z));
      break;
    case "Multiply":
      if (fs.length >= 2) return (z) => fs.reduce<Complex>((acc, g) => mul(acc, g(z)), [1, 0]);
      break;
    case "Divide":
      if (fs.length === 2) return (z) => div(f(0)(z), f(1)(z));
      break;
    case "Power": {
      if (fs.length !== 2) break;
      // A small non-negative integer exponent is repeated multiplication: free of the
      // branch cut, and exact at the origin.
      const e = numberOf(args[1]);
      if (e !== undefined && Number.isInteger(e) && e >= 0 && e <= 8) {
        const base = f(0);
        return (z) => {
          const b = base(z);
          let acc: Complex = [1, 0];
          for (let k = 0; k < e; k++) acc = mul(acc, b);
          return acc;
        };
      }
      return (z) => pow(f(0)(z), f(1)(z));
    }
    case "Root":
      if (fs.length === 2) return (z) => pow(f(0)(z), div([1, 0], f(1)(z)));
      break;
    case "Zeta":
      if (fs.length === 1) return (z) => ofCx(hurwitzZeta(toCx(f(0)(z)), { re: 1, im: 0 }));
      if (fs.length === 2) return (z) => ofCx(zetaGeneralized(toCx(f(0)(z)), toCx(f(1)(z))));
      break;
    case "HurwitzZeta":
      if (fs.length === 2) return (z) => ofCx(hurwitzZeta(toCx(f(0)(z)), toCx(f(1)(z))));
      break;
    case "PolyLog":
      if (fs.length === 2) return (z) => ofCx(polyLog(toCx(f(0)(z)), toCx(f(1)(z))));
      break;
    case "LerchPhi":
      if (fs.length === 3)
        return (z) => ofCx(lerchPhi(toCx(f(0)(z)), toCx(f(1)(z)), toCx(f(2)(z))));
      break;
    case "PolyGamma": {
      // The order is a literal integer: the kernel is ζ(m+1, z) scaled, not analytic in m.
      const m = numberOf(args[0]);
      if (fs.length === 2 && m !== undefined && Number.isInteger(m) && m >= 0) {
        return m === 0
          ? (z) => ofCx(digamma(toCx(f(1)(z))))
          : (z) => ofCx(polygamma(m, toCx(f(1)(z))));
      }
      break;
    }
    default: {
      const unary = UNARY[head] ?? UNARY[capitalize(head)];
      if (unary && fs.length === 1) return (z) => unary(f(0)(z));
    }
  }
  throw new Unsupported(`unsupported ${head}/${args.length}`);
}

/**
 * Compile canonical MathJSON to a complex-valued function of `variable`, or `undefined`
 * if it uses anything without a complex lowering here (an unbound symbol, an unknown
 * head) -- the caller falls back to the engine's own numeric evaluation.
 */
export function complexFunction(json: unknown, variable = "z"): ComplexFunction | undefined {
  try {
    return compile(json as Json, variable);
  } catch (error) {
    if (error instanceof Unsupported) return undefined;
    throw error;
  }
}

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
      const w: Complex =
        values instanceof Float32Array ? [values[k * 2], values[k * 2 + 1]] : values[k];
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
export function sampleComplexSurface(
  f: ComplexFunction,
  opts: ComplexSurfaceOptions = {},
): ComplexSurface {
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

/** The face colour for a hue in [0, 1): the same wheel the portrait paints. */
export const hueColor = (t: number): string =>
  Number.isFinite(t)
    ? `hsl(${Math.round((((t % 1) + 1) % 1) * 360)} 75% 55%)`
    : "var(--notatio-border, #999)";

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

export interface ComplexSurfaceSvgOptions extends Omit<
  Surface3dOptions,
  "xs" | "ys" | "colorLegend" | "zScale"
> {}

/** The surface as SVG: heights from the grid, each face coloured by its corners' hues. */
export function complexSurfaceSvg(
  surface: ComplexSurface,
  opts: ComplexSurfaceSvgOptions = {},
): string {
  const { heights, hues, xs, ys } = surface;
  return surfaceSvg(heights, {
    // Mesh lines thin out as the grid densifies, or a GPU-resolution surface is all edge.
    edgeWidth: Math.min(0.5, 30 / Math.max(xs.length, ys.length)),
    ...opts,
    xs,
    ys,
    fill: ({ i, j }) =>
      hueColor(faceHue([hues[j][i], hues[j][i + 1], hues[j + 1][i + 1], hues[j + 1][i]])),
  });
}
