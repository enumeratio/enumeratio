// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { type NumberKernel } from "../../../collections/src/families/types.ts";
import { IsLabeledTreeOf, LabeledTreeCount, LabeledTreeRank, LabeledTreeUnrank } from "./collections-kernels-extra.ts";

export const labeledTreesKernel: NumberKernel = {
  head: "LabeledTrees",
  paramCount: 1,
  kind: "blocks",
  carrier: "LabeledTree",
  count: ([n]) => LabeledTreeCount(n),
  unrank: ([n], r) => LabeledTreeUnrank(n, r),
  valid: (e, [n]) => IsLabeledTreeOf(e as number[][], n),
  rank: (e, [n]) => LabeledTreeRank(e as number[][], n),
};
