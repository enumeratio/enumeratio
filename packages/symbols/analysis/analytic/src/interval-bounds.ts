import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";

// Rigorous endpoints for an interval image: the promise an `Interval` result makes is that
// it CONTAINS every value the function takes on the input (enumeratio/enumeratio#113 §2 --
// "rigorous containment", as Wolfram's `Interval` also promises). An exact endpoint (`1/2`,
// `Sqrt(3)`, `Arctan(3)`) keeps that promise by being exactly right. An inexact one -- the
// value at a float endpoint, or at a numerically located extremum -- keeps it by being
// rounded OUTWARD: down for a lower bound, up for an upper bound, past any error in the
// digits it was computed from.
//
// Which values need it depends on where they came from. compute-engine treats a float
// literal as the decimal it is written as, and does `+`, `-` and `×` on such decimals exactly:
// `Interval(1.4, 1.5) + 1` is exactly `Interval(2.4, 2.5)`, and stepping that outward would
// only add noise. So an ARITHMETIC result is rounded outward only when compute-engine itself
// rounded it -- when it carries as many digits as a double or more (`1/3.3`); a short decimal
// is exact. A FUNCTION value at an inexact point (`Sin(1.4)`, `Γ(1.4)`) is always a rounding
// of an irrational number, so it is always stepped outward.
//
// How far depends on the digits it was computed from. `N()` evaluates at compute-engine's
// working precision (21 digits by default), and for every head that honours it the result is
// good to far better than a double's half-ulp -- so rounding it to a double and stepping ONE
// ulp outward is a true bound. A head whose `N()` ignores the precision and hands back a
// double (`BarnesG`, `PolyLog`, `LerchPhi`, `StieltjesGamma` -- the heads pinned as aspirational
// in the reference's `N(x, d)` examples) is only as good as its own double evaluation, so it
// steps `DOUBLE_SOURCE_ULPS` outward instead: a margin, not a proof, which is why those heads
// are listed as not rigorous (see interval.ts).

/** Outward steps for a bound computed as a bare double rather than at working precision. */
const DOUBLE_SOURCE_ULPS = 8;

/** Significant digits in a double, at most: a decimal carrying more came from compute-engine's
 * arbitrary-precision arithmetic. */
const DOUBLE_DIGITS = 17;

/** An arithmetic result this short is an exact decimal: rounding -- to a double, or to the
 * working precision -- leaves 16 digits or more. */
const EXACT_DECIMAL_DIGITS = 15;

const scratch = new Float64Array(1);
const scratchBits = new BigInt64Array(scratch.buffer);

/** The next double above `x` (toward +∞). */
export function nextUp(x: number): number {
  if (Number.isNaN(x) || x === Infinity) return x;
  if (x === 0) return Number.MIN_VALUE;
  scratch[0] = x;
  scratchBits[0] += x > 0 ? 1n : -1n;
  return scratch[0];
}

/** The next double below `x` (toward −∞). */
export const nextDown = (x: number): number => -nextUp(-x);

/** Is `e` exact all the way down -- no inexact number literal anywhere in it? `Pi`, `Sqrt(3)`
 * and `Arctan(1/3)` are; `1.4` and `Sin(1.4)` are not. */
export function isExactExpression(e: BoxedExpression): boolean {
  // Both live on compute-engine's narrowed number-literal interface, which the `Expression`
  // union doesn't expose a typed route to (the same cast collections/src/list-stats.ts makes).
  const literal = e as unknown as { isNumberLiteral?: boolean; isExact?: boolean };
  if (literal.isNumberLiteral === true) return literal.isExact === true;
  return operandsOf(e).every(isExactExpression);
}

/** Significant digits in a decimal string's mantissa (`"-0.00125e+3"` has 3). */
const significantDigits = (num: string): number =>
  (num.split(/e/i)[0] ?? "").replace(/[^0-9]/g, "").replace(/^0+/, "").length;

/** `x` stepped `n` doubles toward −∞ (`"lo"`) or +∞ (`"hi"`). */
const stepOutward = (x: number, side: "lo" | "hi", n: number): number => {
  let y = x;
  for (let i = 0; i < n; i++) y = side === "lo" ? nextDown(y) : nextUp(y);
  return y;
};

/** Where a bound's value came from -- which decides whether it can already be exact. */
export type BoundOrigin = "arithmetic" | "function";

/**
 * `value` as a safe `side` bound of an image: itself when it is exact, otherwise its numeric
 * value rounded outward -- one ulp past a working-precision value, `DOUBLE_SOURCE_ULPS` past a
 * bare double (see the file header). An infinite bound is already as safe as it gets.
 */
export function outwardBound(
  ce: ComputeEngine,
  value: BoxedExpression,
  side: "lo" | "hi",
  origin: BoundOrigin,
): BoxedExpression {
  if (isExactExpression(value)) return value;
  const numeric = value.N();
  const re = numeric.re;
  if (!Number.isFinite(re)) return numeric;
  const json = numeric.json;
  const digits =
    typeof json === "number"
      ? String(json)
      : typeof (json as { num?: unknown }).num === "string"
        ? (json as { num: string }).num
        : undefined;
  if (digits === undefined) return numeric; // not a real number: nothing to round
  const count = significantDigits(digits);
  if (origin === "arithmetic" && count <= EXACT_DECIMAL_DIGITS) return numeric;
  return ce.number(stepOutward(re, side, count > DOUBLE_DIGITS ? 1 : DOUBLE_SOURCE_ULPS));
}
