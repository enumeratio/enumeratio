// Successor(c, x): the element after x in collection c's own order. Past the last element, or for
// an x that is no member, it stays unevaluated; wrapping around is At and Mod, written by the caller.
//
// The Epsil definition is the meaning; a declared family answers by its rank kernel
// (`familySuccessor`), which `tests/successor.test.ts` holds to the definition. Anything else
// finite is answered by the definition itself.

import { type Engine, type Expr } from "@enumeratio/engine";
import { evaluateEpsil } from "@enumeratio/structures";

import { familySuccessor } from "./families/declare.ts";
import { add, at, iff, lets, less, and } from "./families/tables.ts";

type MathJSON = unknown;

/** The element at position IndexOf(_c, _x) + 1, or `Nothing` where _x is no member (IndexOf is 0)
 *  or is the last element. */
export const SUCCESSOR_EPSIL: MathJSON = lets(
  [["sp", ["IndexOf", "_c", "_x"], "integer"]],
  iff(and(["Greater", "sp", 0], less("sp", ["Count", "_c"])), at("_c", add("sp", 1)), "Nothing"),
);

export function declareSuccessor(ce: Engine): void {
  ce.declare("Successor", {
    signature: "(indexed_collection<any>, any) -> unknown",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const [collection, target] = ops;
      if (collection === undefined || target === undefined) return undefined;
      const fast = familySuccessor(ce, collection);
      if (fast !== undefined) {
        const answer = fast(collection, target);
        // null is a verdict (last element, non-member); undefined is the kernel declining.
        if (answer !== undefined) return answer ?? undefined;
      }
      // No family, or a kernel that declined: the definition answers. Walking a collection too big
      // for it hits compute-engine's iteration limit and leaves the call unevaluated.
      try {
        const value = evaluateEpsil(ce, SUCCESSOR_EPSIL, { _c: collection.json, _x: target.json });
        return value === "Nothing" ? undefined : ce.box(value as never);
      } catch {
        return undefined;
      }
    },
  });
}
