import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/engine";

// cortex-js/compute-engine: `Solve`'s single-unknown path (`library/solve.ts`) calls
// `equation.solve(unknown)` and returns `List()` (no solutions) whenever that comes back
// empty -- whether the equation is genuinely unsatisfiable (`1 == 0`) or an IDENTITY, true for
// every value of the unknown (`x == x`, `0 == 0`, `x + 1 == x + 1`), which Wolfram reports as
// ONE solution with no constraint (`Solve[x == x, x]` -> `{{}}`, not `{}`). Distinguished here
// by evaluating the equation on its own, independent of solving for the unknown: an identity
// evaluates all the way to the symbol `True` (compute-engine already proves `x == x`, `0 == 0`
// and `x + 1 == x + 1` this way); a genuinely false equation evaluates to `False` and keeps
// the native empty answer; anything that stays an unevaluated relation is a real solve and is
// untouched either way.
export function evaluateSolveIdentity(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Solve");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  const native = operator?.evaluate;
  if (operator === undefined || native === undefined) return;

  operator.evaluate = (ops, options) => {
    const result = native(ops, options);
    if (!isEmptySolutionList(result)) return result;
    const condition = ops[0];
    if (condition === undefined || symbolNameOf(condition.evaluate()) !== "True") return result;
    return ce.function("List", [ce.function("List", [])]);
  };
}

/** Is `expr` `Solve`'s native "no solutions" answer -- `List()`, zero operands? */
function isEmptySolutionList(expr: BoxedExpression | undefined): boolean {
  return expr !== undefined && expr.operator === "List" && operandsOf(expr).length === 0;
}
