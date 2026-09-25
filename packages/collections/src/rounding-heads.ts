import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { widenSignature, wrapOperator } from "@enumeratio/boxed";

// #113 rounding and clamping widenings: Floor/Ceil to a step, Chop with a tolerance,
// Clamp with Clip's replacement values, and the empty-call identity elements of Min/Max.
// Kept apart from list-heads.ts, which packages/collections' other #113 lane (list items)
// is editing at the same time.

/** Declare the rounding/clamping widenings on `ce`. */
export function declareRoundingHeads(ce: ComputeEngine): void {
  // Floor(x, step) / Ceil(x, step): round to the nearest multiple of `step` at or below
  // (resp. at or above) x -- step*Floor(x/step). The native 1-argument Floor/Ceil only
  // decides a BARE constant (Floor(Pi)) numerically, not a compound expression like
  // `4/5*(2π-e)` -- so the division is forced through `.N()` to pick the integer, and that
  // integer is then multiplied by the untouched, still-exact step (never the `.N()`'d one),
  // which is what keeps a rational step exact all the way to the result.
  for (const head of ["Floor", "Ceil"] as const) {
    widenSignature(ce, head, "(any, any?) -> any");
    wrapOperator(
      ce,
      [head, 226, 10],
      () => true,
      () => (ops) => {
        const [x, step] = ops;
        const rounded = ce.function(head, [ce.function("Divide", [x, step])]).N();
        return ce.function("Multiply", [step, rounded]).evaluate();
      },
      2,
    );
  }

  // Chop(x, tolerance): the same near-zero cleanup as the 1-argument form, but with the
  // threshold as an argument instead of the fixed ~1e-10.
  widenSignature(ce, "Chop", "(any, any?) -> any");
  wrapOperator(
    ce,
    ["Chop", 0.001, 0.01],
    () => true,
    () => (ops) => {
      const [x, tolerance] = ops;
      const tol = tolerance.N().re;
      if (tol === undefined || !Number.isFinite(tol)) return undefined;
      const chopPart = (part: BoxedExpression): BoxedExpression => {
        const value = part.N().re;
        return value !== undefined && Number.isFinite(value) && Math.abs(value) < tol
          ? ce.Zero
          : part;
      };
      if (x.operator === "Complex" || (x.im !== undefined && Number.isFinite(x.im) && x.im !== 0)) {
        const re = ce.number(x.re ?? 0);
        const im = ce.number(x.im ?? 0);
        const choppedRe = chopPart(re);
        const choppedIm = chopPart(im);
        return choppedIm.isSame(ce.Zero)
          ? choppedRe
          : ce.function("Complex", [choppedRe, choppedIm]);
      }
      return chopPart(x);
    },
    2,
  );

  // Clamp(x, lower, upper, vLower, vUpper): Wolfram's Clip[x, {lower, upper}, {vLower,
  // vUpper}] -- replacement values outside the range, rather than the nearer bound.
  widenSignature(ce, "Clamp", "(any, any?, any?, any?, any?) -> any");
  wrapOperator(
    ce,
    ["Clamp", 5, 0, 3, -1, 10],
    () => true,
    () => (ops) => {
      const [x, lower, upper, vLower, vUpper] = ops;
      if (x.isLess(lower) === true) return vLower;
      if (x.isGreater(upper) === true) return vUpper;
      return x;
    },
    5,
  );

  // Min() -> +∞, the identity element for Min under the pool it flattens; Max already
  // returns NaN with an accepted divergence note (Wolfram's -∞ isn't pinned as an example).
  // The native signature requires at least one argument, so it has to widen to admit a
  // bare `Min()` at boxing at all.
  widenSignature(ce, "Min", "(any*) -> any");
  wrapOperator(
    ce,
    ["Min"],
    () => true,
    () => () => ce.symbol("PositiveInfinity"),
    0,
  );
}
