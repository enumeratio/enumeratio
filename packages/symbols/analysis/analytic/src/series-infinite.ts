import { bigIntegerAt, type Engine, type Expr, extendHead, operandsOf } from "@enumeratio/engine";
import type { EvalOptions } from "@enumeratio/ce-patches";

// `Series(f, x, DirectedInfinity(z), n)`: compute-engine runs its Taylor rule at the point with
// f and its derivatives "evaluated" at an infinity, which is no expansion (`Ai(∞) + (x − ∞)·Ai′(∞)`).
// The expansion at infinity is an asymptotic series in 1/x, which it has not got, so the call
// stays as written. A symbolic direction is the one case native does not decline already.
//
// Likewise `Series(₂F₁(a, b; c; x), x, 1, n)`: at x = 1 the function runs in powers of (1−x)^(c−a−b)
// and logarithms, so the Taylor rule's derivatives are poles, not coefficients. Only a terminating
// series is analytic there.

const isNonpositiveInteger = (op: Expr | undefined): boolean => {
  const n = bigIntegerAt(op);
  return n !== undefined && n <= 0n;
};

/** `Series(₂F₁(a, b; c; x), x, 1, n)` for a ₂F₁ that does not terminate. */
function expandsAtSingularity([f, variable, point]: readonly Expr[]): boolean {
  if (f?.operator !== "Hypergeometric2F1" || variable === undefined || bigIntegerAt(point) !== 1n) return false;
  const [a, b, , z] = operandsOf(f);
  return z !== undefined && z.isSame(variable) && !isNonpositiveInteger(a) && !isNonpositiveInteger(b);
}

export function declareSeriesInfinite(ce: Engine): void {
  const native = ce.lookupDefinition("Series");
  if (native === undefined || !("operator" in native)) return;
  const before = native.operator.evaluate;
  extendHead(ce, "Series", {
    evaluate: (ops: readonly Expr[], options: EvalOptions) =>
      ops[2]?.operator === "DirectedInfinity" || expandsAtSingularity(ops) ? undefined : before?.(ops, options),
  });
}
