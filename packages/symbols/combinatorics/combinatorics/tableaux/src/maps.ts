// Combinatorial maps whose `from` carrier is a tableaux carrier (conventions as in
// `permutations/src/maps.ts`).

import { bind, type CombinatorialMap, type MathJSON } from "../../src/map-helpers.ts";
import { inverseRsk } from "./families/rsk-pairs.ts";

/** The rows of one tableau of the pair: a pair's contents are two `StandardTableau(rows)`, and
 *  `At` doesn't see through the constructor, but a lambda argument does. */
const rowsOf = (side: number): MathJSON => ["Apply", ["Function", ["At", "tb", 1], "tb"], ["At", "_raw", side]];

export const TABLEAUX_MAPS: readonly CombinatorialMap[] = [
  {
    name: "ToPermutation",
    from: "standard_tableau_pair",
    to: "permutation",
    body: bind(
      "pp",
      rowsOf(1),
      bind("qq", rowsOf(2), inverseRsk("pp", "qq", ["Count", ["Flatten", "pp"]]) as MathJSON, "list<list<integer>>"),
      "list<list<integer>>",
    ),
    summary: "The permutation an RSK pair comes from: inverse RSK.",
    note: "Unbumps the cell holding n in Q, then n − 1, and so on, each time reading a letter off the first row of P.",
  },
];
