import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { type EvalOptions, isFiniteNum, wantsNumber } from "./box.ts";

// Gudermannian(x) = 2 arctan(tanh(x/2)) = arctan(sinh(x)) — links the circular and
// hyperbolic functions without complex numbers. Exact at 0 and at the horizontal
// asymptotes ±π/2 (at ±∞); an odd function, so `Gudermannian(-x)` is pulled apart into
// `-Gudermannian(x)` symbolically, same as `Arcsin`/`Ln` do in widened.ts. Otherwise
// numeric only, real domain (no reference example calls for a complex argument).

const HALF_PI = (ce: ComputeEngine): BoxedExpression => ce.function("Multiply", [ce.number([1, 2]), ce.Pi]).evaluate();

function evaluateGudermannian(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  options: EvalOptions,
): BoxedExpression | undefined {
  const x = ops[0];
  if (x === undefined) return undefined;
  if (x.is(0)) return ce.Zero;
  if (x.re === Infinity && x.im === 0) return HALF_PI(ce);
  if (x.re === -Infinity && x.im === 0) return ce.function("Negate", [HALF_PI(ce)]).evaluate();
  if (x.operator === "Negate") {
    const inner = operandsOf(x)[0];
    if (inner !== undefined) {
      return ce.function("Negate", [ce.function("Gudermannian", [inner])]).evaluate();
    }
  }
  if (wantsNumber(ops, options)) {
    const approx = isFiniteNum(x) ? x : x.N();
    if (isFiniteNum(approx) && approx.im === 0) return ce.number(Math.atan(Math.sinh(approx.re)));
  }
  return undefined; // stay symbolic
}

export function declareGudermannian(ce: ComputeEngine): void {
  ce.declare("Gudermannian", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => evaluateGudermannian(ce, ops, options),
  });
}
