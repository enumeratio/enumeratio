import { type Engine, type Expr, extendHead } from "@enumeratio/engine";
import type { EvalOptions } from "@enumeratio/ce-patches";

// `Series(f, x, DirectedInfinity(z), n)`: compute-engine runs its Taylor rule at the point with
// f and its derivatives "evaluated" at an infinity, which is no expansion (`Ai(∞) + (x − ∞)·Ai′(∞)`).
// The expansion at infinity is an asymptotic series in 1/x, which it has not got, so the call
// stays as written. A symbolic direction is the one case native does not decline already.

export function declareSeriesInfinite(ce: Engine): void {
  const native = ce.lookupDefinition("Series");
  if (native === undefined || !("operator" in native)) return;
  const before = native.operator.evaluate;
  extendHead(ce, "Series", {
    evaluate: (ops: readonly Expr[], options: EvalOptions) =>
      ops[2]?.operator === "DirectedInfinity" ? undefined : before?.(ops, options),
  });
}
