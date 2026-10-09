import { type Engine, type Expr, widenSignature, wrapOperator } from "@enumeratio/engine";

// #113 rounding and clamping widenings: Chop with a tolerance,
// Clamp with Clip's replacement values, and the empty-call identity elements of Min/Max.
// Kept apart from list-heads.ts, which packages/symbols/combinatorics/collections' other #113 lane (list items)
// is editing at the same time.

/** Declare the rounding/clamping widenings on `ce`. */
export function declareRoundingHeads(ce: Engine): void {
  // Chop(x, tolerance): the same near-zero cleanup as the 1-argument form, but with the
  // threshold as an argument instead of the fixed ~1e-10.
  widenSignature(ce, "Chop", "(any, number?) -> any");
  // compile builtin up to 1 operand: the tolerance is an operand past the native call
  wrapOperator(
    ce,
    ["Chop", 0.001, 0.01],
    () => true,
    () => (ops) => {
      const [x, tolerance] = ops;
      const tol = tolerance.N().re;
      if (tol === undefined || !Number.isFinite(tol)) return undefined;
      const chopPart = (part: Expr): Expr => {
        const value = part.N().re;
        return value !== undefined && Number.isFinite(value) && Math.abs(value) < tol ? ce.Zero : part;
      };
      if (x.operator === "Complex" || (x.im !== undefined && Number.isFinite(x.im) && x.im !== 0)) {
        const re = ce.number(x.re ?? 0);
        const im = ce.number(x.im ?? 0);
        const choppedRe = chopPart(re);
        const choppedIm = chopPart(im);
        return choppedIm.isSame(ce.Zero) ? choppedRe : ce.function("Complex", [choppedRe, choppedIm]);
      }
      return chopPart(x);
    },
    { arity: 2, compile: { upTo: 1 } },
  );

  // Clamp(x, lower, upper, vLower, vUpper): Wolfram's Clip[x, {lower, upper}, {vLower,
  // vUpper}] -- replacement values outside the range, rather than the nearer bound.
  widenSignature(ce, "Clamp", "(any, any?, any?, any?, any?) -> any");
  // compile builtin up to 3 operands: the replacement values are operands past the native call
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
    { arity: 5, compile: { upTo: 3 } },
  );

  // Min() -> +∞, the identity element for Min under the pool it flattens; Max already
  // returns NaN with an accepted divergence note (Wolfram's -∞ isn't pinned as an example).
  // The native signature requires at least one argument, so it has to widen to admit a
  // bare `Min()` at boxing at all.
  widenSignature(ce, "Min", "(any*) -> any");
  // compile builtin: Min() is +Infinity, as the built-in lowering gives
  wrapOperator(
    ce,
    ["Min"],
    () => true,
    () => () => ce.symbol("PositiveInfinity"),
    { arity: 0, compile: "builtin" },
  );
}
