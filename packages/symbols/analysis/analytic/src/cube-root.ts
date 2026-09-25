import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { EvalOptions } from "./box.ts";

// CubeRoot(x) — Wolfram's real cube root. compute-engine's own `Root(x, 3)` already takes
// the real branch at a negative base (`Root(-64, 3)` is `-3`, not a complex value), so this
// is a thin reduction to it rather than a new numeric kernel. Real domain only, matching
// Wolfram: a concretely complex operand is left unevaluated.

function evaluateCubeRoot(
  ce: ComputeEngine,
  x: BoxedExpression | undefined,
  options: EvalOptions,
): BoxedExpression | undefined {
  if (x === undefined) return undefined;
  if (Number.isFinite(x.im) && x.im !== 0) return undefined; // real domain only
  const expr = ce.function("Root", [x, 3]);
  return options.numericApproximation ? expr.N() : expr.evaluate();
}

export function declareCubeRoot(ce: ComputeEngine): void {
  ce.declare("CubeRoot", {
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => evaluateCubeRoot(ce, ops[0], options),
  });
}
