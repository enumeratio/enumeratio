// RootedForests split out of collections/src/families/core.ts (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5 -- wire-carriers lane A-92: it now
// carries the new "RootedForest" carrier, matching its element (kind "ints", a length-n parent
// array; entry 0 marks a root, same encoding LabeledTrees' Prüfer bijection already builds it
// from). Kept apart from labeled.ts: a different kind ("ints" vs "blocks"), no reason to share.
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import {
  RootedForestCount,
  RootedForestUnrank,
  RootedForestRank,
  IsRootedForest,
} from "../../../collections/src/families/kernels-extra.ts";

export const entries: NumberKernel[] = [
  {
    head: "RootedForests",
    paramCount: 1,
    kind: "ints",
    carrier: "RootedForest",
    count: ([n]) => RootedForestCount(n),
    unrank: ([n], r) => RootedForestUnrank(n, r),
    valid: (a, [n]) => IsRootedForest(a, n),
    rank: (a, [n]) => RootedForestRank(a as number[], n),
  },
];
