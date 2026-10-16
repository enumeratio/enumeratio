// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { type NumberKernel } from "../../../collections/src/families/types.ts";
import {
  IsRootedForest,
  RootedForestCount,
  RootedForestRank,
  RootedForestUnrank,
} from "./collections-kernels-extra.ts";

export const rootedForestsKernel: NumberKernel = {
  head: "RootedForests",
  paramCount: 1,
  kind: "ints",
  carrier: "RootedForest",
  count: ([n]) => RootedForestCount(n),
  unrank: ([n], r) => RootedForestUnrank(n, r),
  valid: (a, [n]) => IsRootedForest(a, n),
  rank: (a, [n]) => RootedForestRank(a as number[], n),
};
