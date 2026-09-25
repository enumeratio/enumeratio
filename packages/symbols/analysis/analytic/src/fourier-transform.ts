import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, ruleOf } from "@enumeratio/boxed";
import { add, cosPi, cx, mul, scale, sinPi, type Cx } from "./complex.ts";
import { type BoxInput, isFiniteNum, numberResult } from "./box.ts";

// Fourier(list) / InverseFourier(list): the numeric discrete Fourier transform of a
// list, or of a rectangular matrix (a 2D DFT is separable -- apply the 1D transform
// along each dimension in turn). Matches Wolfram's default `FourierParameters -> {0, 1}`
// exactly: kernel sign +1, normalisation 1/sqrt(n) (confirmed against wolframscript).
// The general two-parameter transform is
//   f_s = sqrt(|b| / n^(1-a)) * Sum_r list_r * Exp(2 pi i b (r-1)(s-1) / n)
// (also confirmed by probing several {a, b} settings). `InverseFourier(list, {a, b})`
// equals `Fourier(list, {-a, -b})` exactly -- probed directly rather than assumed --
// so both heads share the one kernel below with the sign of the parameters flipped.
//
// Wolfram's Fourier is inherently numeric: even all-exact input like `Fourier[{0,0,0}]`
// or `Fourier[{1,2,3,4}]` comes back as machine-precision floats, never a symbolic or
// exact result (confirmed by probing) -- so this always numericises a fully numeric
// input and declines (evaluate returns undefined) for anything else: a symbolic entry,
// an empty list, a ragged nested list, or a "list" more than two levels deep.
//
// O(n^2) direct summation, not an FFT. Correct for any n and fast enough for the sizes
// these heads see in practice (worked examples, small demo signals); a genuinely large
// transform would want a radix-2 or Bluestein implementation instead of this one.

const complexAt = (x: BoxedExpression): Cx | undefined => (isFiniteNum(x) ? cx(x.re, x.im) : undefined);

function asVector(expr: BoxedExpression): Cx[] | undefined {
  if (expr.operator !== "List") return undefined;
  const ops = operandsOf(expr);
  if (ops.length === 0) return undefined;
  const vals = ops.map(complexAt);
  return vals.some((v) => v === undefined) ? undefined : (vals as Cx[]);
}

function asMatrix(expr: BoxedExpression): Cx[][] | undefined {
  if (expr.operator !== "List") return undefined;
  const rows = operandsOf(expr);
  if (rows.length === 0) return undefined;
  const vecs = rows.map(asVector);
  if (vecs.some((v) => v === undefined)) return undefined;
  const m = vecs as Cx[][];
  const width = m[0].length;
  return width > 0 && m.every((row) => row.length === width) ? m : undefined;
}

/** `Exp(i * pi * x)`, exact (0 or ±1 per component) at multiples of ½ -- keeps the
 * common small-n cases (n a power of two, resonant angles) free of the ~1e-16 rounding
 * noise `Math.cos`/`Math.sin` would otherwise leave in every entry. */
const cisPi = (x: number): Cx => cx(cosPi(x), sinPi(x));

/** The unnormalised DFT kernel sum only (`FourierParameters` prefactor left out, so a
 * 2D transform can fold both dimensions' prefactors into a single multiplication --
 * see `dft2`). */
function kernelSum(vec: readonly Cx[], b: number): Cx[] {
  const n = vec.length;
  const out: Cx[] = Array.from({ length: n });
  for (let s = 0; s < n; s++) {
    let sum = cx(0);
    for (let r = 0; r < n; r++) sum = add(sum, mul(vec[r], cisPi((2 * b * r * s) / n)));
    out[s] = sum;
  }
  return out;
}

const prefactor = (n: number, a: number, b: number): number => Math.sqrt(Math.abs(b) / Math.pow(n, 1 - a));

/** The 1D DFT of `vec` under `FourierParameters -> {a, b}`. */
function dft1(vec: readonly Cx[], a: number, b: number): Cx[] {
  const pref = prefactor(vec.length, a, b);
  return kernelSum(vec, b).map((z) => scale(z, pref));
}

const transpose = (m: readonly Cx[][]): Cx[][] => m[0].map((_, j) => m.map((row) => row[j]));

/**
 * The 2D DFT, separable: the kernel sum along the rows, then along the columns of that
 * result, with both dimensions' prefactors combined into ONE multiplication at the end
 * -- `sqrt(p) * sqrt(q)` and `sqrt(p * q)` agree in exact arithmetic but not always in
 * floating point, and folding them avoids that extra rounding (confirmed against
 * Wolfram's clean machine-precision output on small examples).
 */
function dft2(mat: readonly Cx[][], a: number, b: number): Cx[][] {
  const m = mat.length;
  const n = mat[0].length;
  const rows = mat.map((row) => kernelSum(row, b));
  const cols = transpose(rows).map((col) => kernelSum(col, b));
  const pref = Math.abs(b) / Math.pow(m * n, (1 - a) / 2);
  return transpose(cols).map((row) => row.map((z) => scale(z, pref)));
}

/**
 * The `FourierParameters -> {a, b}` option among the trailing rule, or the default
 * `{0, 1}` when there is none. `undefined` for anything unrecognised: a different
 * option name, or a value that isn't a 2-element real list -- declined rather than
 * guessed at.
 */
function fourierParameters(ce: ComputeEngine, ops: readonly BoxedExpression[]): readonly [number, number] | undefined {
  if (ops.length === 1) return [0, 1];
  if (ops.length !== 2 || ops[1] === undefined) return undefined;
  const rule = ruleOf(ops[1].json as never);
  if (rule === undefined || rule.name !== "FourierParameters") return undefined;
  const vec = asVector(ce.box(rule.value as BoxInput));
  if (vec === undefined || vec.length !== 2 || vec[0].im !== 0 || vec[1].im !== 0) return undefined;
  return [vec[0].re, vec[1].re];
}

function evaluateFourier(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  invert: boolean,
): BoxedExpression | undefined {
  const params = fourierParameters(ce, ops);
  const listExpr = ops[0];
  if (params === undefined || listExpr === undefined) return undefined;
  const [a, b] = invert ? [-params[0], -params[1]] : params;
  const vec = asVector(listExpr);
  if (vec !== undefined) {
    return ce
      .function(
        "List",
        dft1(vec, a, b).map((r) => numberResult(ce, r)),
      )
      .evaluate();
  }
  const mat = asMatrix(listExpr);
  if (mat !== undefined) {
    return ce
      .function(
        "List",
        dft2(mat, a, b).map((row) =>
          ce.function(
            "List",
            row.map((r) => numberResult(ce, r)),
          ),
        ),
      )
      .evaluate();
  }
  return undefined;
}

export function declareFourierTransform(ce: ComputeEngine): void {
  ce.declare("Fourier", {
    signature: "(list, any?) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateFourier(ce, ops, false),
  });
  ce.declare("InverseFourier", {
    signature: "(list, any?) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateFourier(ce, ops, true),
  });
}
