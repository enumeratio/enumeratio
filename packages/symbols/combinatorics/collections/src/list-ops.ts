import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";

/** Declare simple list manipulation heads: Prepend. */
export function declareListOps(ce: ComputeEngine): void {
  ce.declare("Prepend", {
    signature: "(collection<any>, value) -> collection",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const list = ops[0];
      const value = ops[1];
      if (list === undefined || value === undefined) return undefined;
      if (list.operator === "Association") return prependToAssociation(ce, list, value);
      if (list.operator !== "List") return undefined;
      const listOps = (list as { ops?: readonly BoxedExpression[] }).ops ?? [];
      return ce.box(["List", value, ...listOps]);
    },
  });
}

/**
 * `Prepend(association, rule)` or `Prepend(association, {rule, …})`: one or more new
 * `key -> value` rules inserted at the front. A prepended key that already occurs later in
 * `association` displaces the old entry entirely (an `Association` holds one value per key,
 * and the new one wins), matching Wolfram — this doesn't merge duplicates WITHIN the new
 * rules themselves, which is also Wolfram's behavior (the last one wins there too).
 */
function prependToAssociation(
  ce: ComputeEngine,
  association: BoxedExpression,
  addition: BoxedExpression,
): BoxedExpression {
  const newRules = addition.operator === "List" ? operandsOf(addition) : [addition];
  const newKeys = new Set(newRules.map((rule) => JSON.stringify(operandsOf(rule)[0]?.json)));
  const kept = operandsOf(association).filter((rule) => !newKeys.has(JSON.stringify(operandsOf(rule)[0]?.json)));
  return ce.box(["Association", ...newRules, ...kept]);
}
