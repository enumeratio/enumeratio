import { type Engine, type Expr, operandsOf } from "@enumeratio/engine";

/** Declare simple list manipulation heads: Prepend. */
export function declareListOps(ce: Engine): void {
  ce.declare("Prepend", {
    signature: "(collection<any>, value) -> collection",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const list = ops[0];
      const value = ops[1];
      if (list === undefined || value === undefined) return undefined;
      if (list.operator === "Association") return prependToAssociation(ce, list, value);
      if (list.operator !== "List") return undefined;
      const listOps = (list as { ops?: readonly Expr[] }).ops ?? [];
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
function prependToAssociation(ce: Engine, association: Expr, addition: Expr): Expr {
  const newRules = addition.operator === "List" ? operandsOf(addition) : [addition];
  const newKeys = new Set(newRules.map((rule) => JSON.stringify(operandsOf(rule)[0]?.json)));
  const kept = operandsOf(association).filter((rule) => !newKeys.has(JSON.stringify(operandsOf(rule)[0]?.json)));
  return ce.box(["Association", ...newRules, ...kept]);
}
