import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt } from "@enumeratio/boxed";
import { type BoxInput, declined, type EvalOptions, isRealInt, type NativeEval } from "./box.ts";
import { gammaExactValue } from "./widened.ts";

// The three-argument generalized incomplete gamma, Wolfram's Gamma[s, z₀, z₁] =
// Γ(s, z₀) − Γ(s, z₁) — which, at z₀ = 0, is the LOWER incomplete gamma γ(s, z). Same for
// GammaRegularized[s, z₀, z₁] = Q(s, z₀) − Q(s, z₁), so P(s, z) = 1 − Q(s, z) is
// GammaRegularized(s, 0, z).
//
// compute-engine 0.128 already has the upper incomplete Γ(s, z) and Q(s, z) = Γ(s,z)/Γ(s)
// for complex s and z, numerically matching Wolfram — so nothing is reimplemented here.
// What it lacks is the third argument, which is purely a difference of two calls it can
// already make, and so is added symbolically: the reduction works for symbolic operands too
// (Gamma(1, 0, z) → 1 − e^{−z}) and inherits whatever accuracy the native handler has.
//
// The one-argument form also gets the exact-value policy decision from issue #92 group B:
// plain evaluation leaves an exact integer or rational Gamma(x) symbolic (a deliberate
// compute-engine policy, reduced only by N()), which this overrides at the integers and
// half-integers via `gammaExactValue` — the same kernel Binomial/Beta/CatalanNumber reuse.

/** Does this result still mention the head it was supposed to reduce away? */
const unreduced = (r: BoxedExpression, head: string): boolean => JSON.stringify(r.json).includes(`"${head}"`);

/**
 * The three-argument form as an expression in the two-argument one. Both are differences of
 * upper tails; the regularized one divides by Γ(s) rather than subtracting two Q values, so
 * that Q(s, 0, z) = 1 − Q(s, z) holds for negative s too (where Γ(s, 0) and Γ(s) are both
 * infinite but their ratio is 1) — which is Wolfram's convention.
 */
const rewrite = (
  ce: ComputeEngine,
  head: "Gamma" | "GammaRegularized",
  ops: readonly BoxedExpression[],
  numeric: boolean,
): BoxedExpression => {
  const [s, z0, z1] = ops.map((o) => o.json as unknown as BoxInput);
  const difference: BoxInput = ["Subtract", ["Gamma", s, z0], ["Gamma", s, z1]] as BoxInput;
  const expr = ce.box(head === "Gamma" ? difference : (["Divide", difference, ["Gamma", s]] as BoxInput));
  return numeric ? expr.N() : expr.evaluate();
};

/**
 * Evaluate `Gamma` / `GammaRegularized`, deferring to compute-engine for one and two
 * arguments and adding the three-argument difference. Γ(1, z) = e^{−z} is filled in on the
 * way through — it is exact, works for symbolic z, and is what makes Γ(1, 0, z) collapse to
 * 1 − e^{−z} the way Wolfram's does.
 */
export function evaluateIncompleteGamma(
  ce: ComputeEngine,
  head: "Gamma" | "GammaRegularized",
  native: NativeEval,
  ops: readonly BoxedExpression[],
  options: EvalOptions,
): BoxedExpression | undefined {
  if (ops.length < 3) {
    const r = native?.(ops, options);
    if (ops.length === 1) {
      if (head !== "Gamma" || !declined(r, head)) return r;
      const x = bigRationalAt(ops[0]);
      return (x !== undefined ? gammaExactValue(ce, x) : undefined) ?? r;
    }
    if (ops.length !== 2 || !declined(r, head)) return r;
    const [s, z] = ops;
    if (s === undefined || z === undefined) return r;
    const sJson = s.json as unknown as BoxInput;
    const zJson = z.json as unknown as BoxInput;
    // Γ(1, z) = e^{−z}: exact, valid for symbolic z, and what makes Γ(1, 0, z) collapse.
    if (head === "Gamma" && isRealInt(s) && s.re === 1) {
      const expr = ce.box(["Exp", ["Negate", zJson]] as BoxInput);
      return options.numericApproximation ? expr.N() : expr.evaluate();
    }
    // Q(s, z) = Γ(s, z)/Γ(s) — the native regularized handler is real-only, while Γ(s, z)
    // itself takes complex s and z, so the quotient covers what it declines. Only for a
    // genuinely complex operand: a real pair it declines (a non-integer s with z < 0, whose
    // value is complex) is left exactly as vanilla compute-engine leaves it.
    if (head === "GammaRegularized" && (s.im !== 0 || z.im !== 0)) {
      const expr = ce.box(["Divide", ["Gamma", sJson, zJson], ["Gamma", sJson]] as BoxInput);
      const q = options.numericApproximation ? expr.N() : expr.evaluate();
      if (!unreduced(q, "Gamma")) return q;
    }
    return r;
  }
  if (ops.length > 3) return undefined; // not a form Wolfram has either
  const r = rewrite(ce, head, ops, options.numericApproximation ?? false);
  // A difference of two calls that did not themselves reduce is no better than the
  // unevaluated call: keep the three-argument form rather than showing the difference.
  if (unreduced(r, "Gamma")) return undefined;
  return r;
}
