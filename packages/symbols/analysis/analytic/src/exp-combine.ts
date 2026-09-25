import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";
import type { Resolver } from "./tagged-arithmetic.ts";

// e^a · e^b = e^(a+b) holds for every complex a, b — unlike x^a · x^b, which only combines
// this way for positive real x. compute-engine already canonicalizes Exp(x) to
// Power(ExponentialE, x) (see Exp.yaml) and already merges same-base powers when it can do
// so structurally (identical exponents, or both numeric) — Exp(2)*Exp(3) and Exp(x)*Exp(x)
// both come out combined natively. What's missing is the general symbolic case,
// Exp(x)*Exp(y), which is only valid to combine because the base is E.
//
// Wired into Multiply's existing tagged-arithmetic dispatch (registerTaggedHead in
// tagged-arithmetic.ts) rather than a second `wrapOperator`, so this doesn't add its own
// evaluate pass over every Multiply in the engine — see that file's comment for why a second
// wrapper measured a ~4x regression on Add/Multiply-heavy code.

/** True when `op` is `Power(ExponentialE, _)`, read structurally off `.operator` and the
 * base operand's `.symbol` — no evaluation, no allocation. Canonicalization already turns
 * `Exp(x)` into this form at box time, so this also matches an un-evaluated `Exp(x)`. */
function isExpPower(op: BoxedExpression): boolean {
  if (op.operator !== "Power") return false;
  const base = operandsOf(op)[0];
  return base !== undefined && symbolNameOf(base) === "ExponentialE";
}

/**
 * O(n), allocation-free gate: at least two `Power(ExponentialE, _)` factors among `ops`.
 * Bails the moment a second one is seen, so a product with zero or one such factor — the
 * overwhelming majority of Multiply calls — costs one early-terminating scan and nothing
 * else.
 */
export function hasTwoExpPowers(ops: readonly BoxedExpression[]): boolean {
  let seen = 0;
  for (const op of ops) if (isExpPower(op) && ++seen === 2) return true;
  return false;
}

/** Registered on Multiply only: gathers every `Power(ExponentialE, _)` factor, sums their
 * exponents, and multiplies the result back with whatever's left. `undefined` (deferring to
 * the native handler) whenever fewer than two such factors survive evaluation — the gate is
 * structural and can admit a call that combines down to one, e.g. a single Exp among several
 * plain factors. */
export function expCombineResolvers(ce: ComputeEngine): Record<string, Resolver> {
  return {
    Multiply: (ops) => {
      const exponents: BoxedExpression[] = [];
      const rest: BoxedExpression[] = [];
      for (const op of ops) {
        if (isExpPower(op)) exponents.push(operandsOf(op)[1]!);
        else rest.push(op);
      }
      if (exponents.length < 2) return undefined;
      const combined = ce
        .function("Power", [ce.symbol("ExponentialE"), ce.function("Add", exponents).evaluate()])
        .evaluate();
      return rest.length === 0 ? combined : ce.function("Multiply", [combined, ...rest]).evaluate();
    },
  };
}
