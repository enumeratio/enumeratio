import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

/**
 * Cancellable evaluation. A promise over `expr.evaluateAsync({ signal })`: an aborted
 * signal rejects it, so a caller re-running a cell or notebook on new input can abort the
 * previous run rather than merely discarding its result.
 */
export function evaluate(
  ce: ComputeEngine,
  expr: BoxedExpression,
  options?: { signal?: AbortSignal },
): Promise<BoxedExpression> {
  void ce; // kept for a uniform (ce, expr, options) call shape across this package
  return expr.evaluateAsync({ signal: options?.signal });
}
