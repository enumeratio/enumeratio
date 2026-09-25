import type { ComputeEngine } from "@cortex-js/compute-engine";
import { declareFamilies } from "./families/declare.ts";
import { declareListHeads } from "./list-heads.ts";
import { declareListOps } from "./list-ops.ts";
import { declareStats, type StatsOptions } from "./stats.ts";

/**
 * Declare the enumeratio combinatorial collection heads on `ce` (SymmetricGroup,
 * Derangements, IntegerPartitions, KSubsets, DyckPaths, SetPartitions, BinaryTrees,
 * and many more), plus the permutation-statistic heads (Inversions, Descents,
 * MajorIndex, …). Each collection is a lazy indexed family answered by unranking,
 * so `Count`/`At` work without materialising it.
 *
 * Pass `permutationType` to declare the statistics over the minted carrier rather than over
 * a bare list — see `StatsOptions`. The carrier types have to exist on `ce` already.
 */
export function declareCollections(ce: ComputeEngine, options: StatsOptions = {}): void {
  declareFamilies(ce);
  declareListOps(ce);
  declareListHeads(ce);
  declareStats(ce, options);
}
