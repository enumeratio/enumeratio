import { isFunction, type Expression } from "@cortex-js/compute-engine";

/**
 * `expr` as a round trip compares it. A lazy head (`Simplify`, `Hold`, …) keeps its operands
 * exactly as written, so `(x+1)(x+2)` reads back with `Delimiter` and `InvisibleOperator`
 * still in it; a non-lazy head's operands are canonical. Held operands are canonicalized
 * here, on both sides, and nothing else is touched.
 */
export function roundTripJson(expr: Expression): unknown {
  if (!isFunction(expr) || !expr.operatorDefinition?.lazy) return expr.json;
  return [expr.operator, ...expr.ops.map((op) => op.canonical.json)];
}
