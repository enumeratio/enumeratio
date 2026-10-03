import { digamma, hurwitzZeta, lerchPhi, logGamma, polygamma, polyLog, zetaGeneralized } from "@enumeratio/analytic";

// A small complex evaluator over canonical MathJSON: the head set `emitComplexWGSL`
// lowers, plus Gamma, on `[re, im]` tuples. `notatio-complex-plot-3d`'s CPU sampler,
// where the GPU doesn't answer. Pure: no DOM, no engine.

/** A complex number as `[re, im]`. */
export type Complex = readonly [number, number];

export type ComplexFunction = (z: Complex) => Complex;

/** MathJSON, in the canonical plain-array form `ce.box(expr).json` returns. */
type Json = number | string | boolean | { [k: string]: unknown } | Json[];

// --- the field, on tuples ---------------------------------------------------------------

const add = (a: Complex, b: Complex): Complex => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Complex, b: Complex): Complex => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Complex, b: Complex): Complex => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
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
const sin = (z: Complex): Complex => [Math.sin(z[0]) * Math.cosh(z[1]), Math.cos(z[0]) * Math.sinh(z[1])];
const cos = (z: Complex): Complex => [Math.cos(z[0]) * Math.cosh(z[1]), -Math.sin(z[0]) * Math.sinh(z[1])];
const sinh = (z: Complex): Complex => [Math.sinh(z[0]) * Math.cos(z[1]), Math.cosh(z[0]) * Math.sin(z[1])];
const cosh = (z: Complex): Complex => [Math.cosh(z[0]) * Math.cos(z[1]), Math.sinh(z[0]) * Math.sin(z[1])];
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

/** `ln` -> `Ln`: a round trip through Epsil can hand back a lowercase head. */
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
      if (fs.length === 3) return (z) => ofCx(lerchPhi(toCx(f(0)(z)), toCx(f(1)(z)), toCx(f(2)(z))));
      break;
    case "PolyGamma": {
      // The order is a literal integer: the kernel is ζ(m+1, z) scaled, not analytic in m.
      const m = numberOf(args[0]);
      if (fs.length === 2 && m !== undefined && Number.isInteger(m) && m >= 0) {
        return m === 0 ? (z) => ofCx(digamma(toCx(f(1)(z)))) : (z) => ofCx(polygamma(m, toCx(f(1)(z))));
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
