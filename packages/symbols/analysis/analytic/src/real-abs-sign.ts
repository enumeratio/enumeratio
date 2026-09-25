import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt } from "@enumeratio/boxed";
import { type EvalOptions, isFiniteNum } from "./box.ts";

// RealAbs(x) and RealSign(x) — Wolfram's real-only Abs and Sign: defined only on the
// reals, unlike compute-engine's native `Abs`/`Sign`, which are complex-valued. Both
// decline on a concretely complex operand.
//
// RealAbs is a thin reduction to the native `Abs`, which already gives the right answer
// on every real form (float, exact rational, exact symbolic like Pi). RealSign is not:
// native `Sign` stays symbolic at an exact expression it can't immediately classify
// (`Sign(Sqrt(2) - 2)` stays `Sign(-2 + sqrt(2))` under plain `evaluate`, only resolving
// under `N()`). Restricted to the reals, though, the sign is always decidable — so
// RealSign always resolves to an exact -1, 0 or 1, falling back to a numeric probe
// (`.N()`) exactly where native `Sign` would rather stay symbolic.

const isConcretelyComplex = (x: BoxedExpression): boolean => Number.isFinite(x.im) && x.im !== 0;

function evaluateRealAbs(
  ce: ComputeEngine,
  x: BoxedExpression | undefined,
  options: EvalOptions,
): BoxedExpression | undefined {
  if (x === undefined) return undefined;
  if (isConcretelyComplex(x)) return undefined; // real domain only
  const expr = ce.function("Abs", [x]);
  return options.numericApproximation ? expr.N() : expr.evaluate();
}

function evaluateRealSign(ce: ComputeEngine, x: BoxedExpression | undefined): BoxedExpression | undefined {
  if (x === undefined) return undefined;
  if (isConcretelyComplex(x)) return undefined; // real domain only
  const q = bigRationalAt(x);
  if (q !== undefined) return ce.number(q[0] > 0n ? 1 : q[0] < 0n ? -1 : 0);
  const approx = isFiniteNum(x) ? x : x.N();
  if (!isFiniteNum(approx) || isConcretelyComplex(approx)) return undefined;
  return ce.number(approx.re > 0 ? 1 : approx.re < 0 ? -1 : 0);
}

export function declareRealAbsSign(ce: ComputeEngine): void {
  ce.declare("RealAbs", {
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => evaluateRealAbs(ce, ops[0], options),
  });

  ce.declare("RealSign", {
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => evaluateRealSign(ce, ops[0]),
  });
}
