// The set-partitions families' TS kernels, read in the order their Epsil definitions list. They answered ahead of Epsil
// until compiled Epsil made that unnecessary (BL-225); tests/fast-kernels.test.ts holds them to the definitions.
import type { FastKernel } from "../../collections/src/families/epsil.ts";
import {
  bellExact,
  fubiniExact,
  stirlingSecondExact,
  surjectionsExact,
} from "../../collections/src/families/exact-recurrences.ts";
import {
  IsSetPartitionOf,
  RgsToBlocks,
  RgsUnrank,
  SetPartitionsIntoKBlocksUnrank,
} from "../../collections/src/families/kernels-combinatorics.ts";
import {
  BlocksToLabels,
  BlocksToRgs,
  LabelsToOrderedBlocks,
  RgsRank,
  SetCompositionRank,
  SetCompositionUnrank,
  SetPartitionsIntoKBlocksRank,
} from "./kernels/collections-kernels-combinatorics.ts";
import { isRestrictedGrowthStringOf } from "./kernels/set-partitions-paths-partitions.ts";
import { readings as matchingReadings } from "./kernels/set-partitions-matchings.ts";
import {
  IsPerfectMatchingOf,
  IsSurjectionOf,
  PerfectMatchingCount,
  PerfectMatchingRank,
  PerfectMatchingUnrank,
  SurjectionRank,
  SurjectionUnrank,
} from "./kernels/collections-kernels-extra.ts";

const matchings = new Map(matchingReadings.map((reading) => [reading.head, reading]));

export const readings: Record<string, FastKernel> = {
  SetPartitions: {
    count: ([n]) => bellExact(n),
    unrank: ([n], r) => RgsToBlocks(RgsUnrank(n, r)),
    rank: (x, [n]) => RgsRank(BlocksToRgs(x as number[][], n)),
    valid: (x, [n]) => IsSetPartitionOf(x as number[][], n),
  },
  SetPartitionsIntoKBlocks: {
    count: ([n, k]) => stirlingSecondExact(n, k),
    unrank: ([n, k], r) => RgsToBlocks(SetPartitionsIntoKBlocksUnrank(n, k, r)),
    rank: (x, [n, k]) => SetPartitionsIntoKBlocksRank(BlocksToRgs(x as number[][], n), k),
    valid: (x, [n, k]) => IsSetPartitionOf(x as number[][], n, k),
  },
  RestrictedGrowthStrings: {
    count: ([n]) => bellExact(n),
    unrank: ([n], r) => RgsUnrank(n, r),
    rank: (x) => RgsRank(x as number[]),
    valid: (x, [n]) => isRestrictedGrowthStringOf(x, n),
  },
  NonCrossingPartitions: matchings.get("NonCrossingPartitions")!,
  NonNestingPartitions: matchings.get("NonNestingPartitions")!,
  NonCrossingMatchings: matchings.get("NonCrossingMatchings")!,
  NonNestingMatchings: matchings.get("NonNestingMatchings")!,
  Surjections: {
    count: ([n, k]) => surjectionsExact(n, k),
    unrank: ([n, k], r) => SurjectionUnrank(n, k, r),
    rank: (x, [, k]) => SurjectionRank(x as number[], k),
    valid: (x, [n, k]) => IsSurjectionOf(x as number[], n, k),
  },
  SetCompositions: {
    count: ([n]) => fubiniExact(n),
    unrank: ([n], r) => LabelsToOrderedBlocks(SetCompositionUnrank(n, r)),
    rank: (x, [n]) => SetCompositionRank(BlocksToLabels(x as number[][]), n),
    valid: (x, [n]) => IsSetPartitionOf(x as number[][], n),
  },
  PerfectMatchings: {
    count: ([n]) => PerfectMatchingCount(n),
    unrank: ([n], r) => PerfectMatchingUnrank(n, r),
    rank: (x, [n]) => PerfectMatchingRank(x as number[][], n),
    valid: (x, [n]) => IsPerfectMatchingOf(x, n),
  },
};
