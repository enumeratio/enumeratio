// Surjections, SetPartitions, SetPartitionsIntoKBlocks, SetCompositions and PerfectMatchings
// split out of collections/src/families/core.ts (which mixed every area) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5. PerfectMatchings, colocated with SetPartitions in core.ts's "set partitions /
// matchings" section, now carries "SetPartition" too: its "blocks" shape (a matching's pairs)
// is exactly SetPartition's shape (list<list<integer>>), so it is wired as a RESTRICTION of
// SetPartition rather than the "PerfectMatching" carrier (whose shape, list<integer>, is a
// different encoding this family's kernel never produces) -- resolving the wiki's open
// question 1. The generic kernel math stays in collections/src/families/kernels*.ts.
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import {
  SurjectionCount,
  SurjectionUnrank,
  SurjectionRank,
  IsSurjectionOf,
  PerfectMatchingCount,
  PerfectMatchingUnrank,
  PerfectMatchingRank,
  IsPerfectMatchingOf,
} from "../../../collections/src/families/kernels-extra.ts";
import {
  BellB,
  RgsUnrank,
  RgsRank,
  RgsToBlocks,
  BlocksToRgs,
  IsSetPartitionOf,
  StirlingS2,
  SetPartitionsIntoKBlocksUnrank,
  SetPartitionsIntoKBlocksRank,
  Fubini,
  SetCompositionUnrank,
  SetCompositionRank,
  LabelsToOrderedBlocks,
  BlocksToLabels,
} from "../../../collections/src/families/kernels-combinatorics.ts";

// helper to cut boilerplate for the flat (number[]) shape; mirrors collections/core.ts's private `ints`.
const ints = (
  head: string,
  paramCount: 1 | 2,
  count: (p: number[]) => number,
  unrank: (p: number[], r: number) => number[],
  valid: (e: number[], p: number[]) => boolean,
  rank: (e: number[], p: number[]) => number,
): NumberKernel => ({
  head,
  paramCount,
  kind: "ints",
  count,
  unrank,
  valid: (e, p) => valid(e as number[], p),
  rank: (e, p) => rank(e as number[], p),
});

// Surjections sat far from SetPartitions/SetPartitionsIntoKBlocks/SetCompositions in core.ts's
// own entries array (core.ts's "subsets/multisets/tuples" section vs. its "set partitions /
// matchings" section) -- kept as two exports so collections/src/families/index.ts can splice each
// back in at its own original position.
export const surjectionsEntries: NumberKernel[] = [
  {
    ...ints(
      "Surjections",
      2,
      ([n, k]) => SurjectionCount(n, k),
      ([n, k], r) => SurjectionUnrank(n, k, r),
      (a, [n, k]) => IsSurjectionOf(a, n, k),
      (a, [, k]) => SurjectionRank(a, k),
    ),
    carrier: "Surjection",
  },
];

export const entries: NumberKernel[] = [
  {
    head: "SetPartitions",
    carrier: "SetPartition",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => BellB(n),
    unrank: ([n], r) => RgsToBlocks(RgsUnrank(n, r)),
    valid: (b, [n]) => IsSetPartitionOf(b as number[][], n),
    rank: (b, [n]) => RgsRank(BlocksToRgs(b as number[][], n)),
  },
  {
    head: "SetPartitionsIntoKBlocks",
    carrier: "SetPartition",
    paramCount: 2,
    kind: "blocks",
    count: ([n, k]) => StirlingS2(n, k),
    unrank: ([n, k], r) => RgsToBlocks(SetPartitionsIntoKBlocksUnrank(n, k, r)),
    valid: (b, [n, k]) => IsSetPartitionOf(b as number[][], n, k),
    rank: (b, [n, k]) => SetPartitionsIntoKBlocksRank(BlocksToRgs(b as number[][], n), k),
  },
  {
    head: "SetCompositions",
    carrier: "SetComposition",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => Fubini(n),
    unrank: ([n], r) => LabelsToOrderedBlocks(SetCompositionUnrank(n, r)),
    valid: (b, [n]) => IsSetPartitionOf(b as number[][], n),
    rank: (b, [n]) => SetCompositionRank(BlocksToLabels(b as number[][]), n),
  },
  {
    head: "PerfectMatchings",
    carrier: "SetPartition",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => PerfectMatchingCount(n),
    unrank: ([n], r) => PerfectMatchingUnrank(n, r),
    valid: (b, [n]) => IsPerfectMatchingOf(b, n),
    rank: (b, [n]) => PerfectMatchingRank(b as number[][], n),
  },
];
