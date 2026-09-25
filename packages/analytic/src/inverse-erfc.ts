import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, wrapOperator } from "@enumeratio/boxed";
import { type EvalOptions, isFiniteNum, wantsNumber } from "./box.ts";

// InverseErfc(s): compute-engine has no such head. Wolfram's InverseErf is native here as
// `ErfInv` and accurate, but computing 1 − s as a plain double loses precision exactly where
// the tail matters (s → 0, y → ∞) — the whole reason a caller reaches for InverseErfc instead
// of InverseErf(1 − s) in the first place. Building `Subtract(1, s)` as a compute-engine
// expression and deferring the double conversion to the final `.N()` keeps that subtraction
// exact (rational/bignum) up to the moment ErfInv needs a float, so InverseErfc(1e-10) keeps
// every digit ErfInv(1 − 1e-10) would otherwise drop.

export function declareInverseErfc(ce: ComputeEngine): void {
  ce.declare("InverseErfc", {
    signature: "(number) -> number",
    broadcastable: true, // InverseErfc([0, 1]) threads, like Wolfram's Listable
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [s] = ops;
      if (s === undefined) return undefined;
      if (s.re === 0 && s.im === 0) return ce.symbol("PositiveInfinity");
      if (s.re === 1 && s.im === 0) return ce.Zero;
      if (s.re === 2 && s.im === 0) return ce.symbol("NegativeInfinity");
      if (!wantsNumber(ops, options) || !isFiniteNum(s) || s.im !== 0) return undefined;
      // erfc(−y) = 2 − erfc(y), so InverseErfc(s) = −InverseErfc(2 − s) for s > 1 — reduces
      // to the s ≤ 1 case, where ErfInv(1 − s) applies directly.
      if (s.re > 1) {
        const flipped = ce.function("InverseErfc", [ce.function("Subtract", [2, s])]).N();
        return ce.function("Negate", [flipped]).evaluate();
      }
      return ce.function("ErfInv", [ce.function("Subtract", [1, s])]).N();
    },
  });

  // Erfc(InverseErfc(x)) = x exactly, including for a symbolic x — compute-engine has no
  // general inverse-composition simplification (checked: ErfInv(Erf(x)) stays unevaluated
  // too), so this extends Erfc in place with the one structural cancellation Wolfram's page
  // documents. Evaluating InverseErfc(x) first would just decline for symbolic x and never
  // reach the identity, so this matches the AST directly instead.
  wrapOperator(
    ce,
    ["Erfc", 1],
    (ops) => ops[0]?.operator === "InverseErfc",
    () => (ops) => operandsOf(ops[0])[0],
  );
}
