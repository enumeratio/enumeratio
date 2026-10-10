// NonCrossingTrees in Epsil: the preorder arity word of a ternary tree with n internal nodes (an
// internal node is a 3, a leaf a 0), the trees listed as FullKAryTrees(n, 3) lists them
// (./kary-words.ts).

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import { karyWord } from "./kary-words.ts";

const word = karyWord(3);

export const nonCrossingTrees: EpsilFamily = {
  head: "NonCrossingTrees",
  paramCount: 1,
  kind: "ints",
  carrier: "NonCrossingTree",
  params: ["_n"],
  // Interpreting the stack walk takes seconds a call past 2^53, so unrank and rank decline there.
  declinePastDoubles: true,
  epsil: {
    count: word.count,
    tables: word.tables,
    unrank: word.unrank,
    rank: word.rank,
    valid: word.valid,
  },
};
