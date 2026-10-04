// LabeledTrees split out of collections/src/families/core.ts (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5 -- wire-carriers lane A-92: it now
// carries "LabeledTree", the edge set (its element already is one, kind "blocks"). Kept apart
// from core.ts's nested-tree families (BinaryTrees/FullKAryTrees/OrderedTrees): a different kind
// ("blocks" vs "nested"), no reason to share a file. RootedForests -- the family LabeledTrees sat
// beside in collections -- still declares no carrier, so it stays there.
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import {
  LabeledTreeCount,
  LabeledTreeUnrank,
  LabeledTreeRank,
  IsLabeledTreeOf,
} from "../../../collections/src/families/kernels-extra.ts";

export const entries: NumberKernel[] = [
  {
    head: "LabeledTrees",
    paramCount: 1,
    kind: "blocks",
    carrier: "LabeledTree",
    count: ([n]) => LabeledTreeCount(n),
    unrank: ([n], r) => LabeledTreeUnrank(n, r),
    valid: (e, [n]) => IsLabeledTreeOf(e as number[][], n),
    rank: (e, [n]) => LabeledTreeRank(e as number[][], n),
  },
];
