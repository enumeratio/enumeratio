// Partitions-area families split out of collections/src/families/core.ts (which mixed every
// area) per https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5: IntegerPartitions and its four siblings, all typed by the "IntegerPartition"
// carrier. The generic kernel math they call stays in collections/src/families/kernels*.ts —
// reused across areas, not partitions-specific machinery.
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import {
  PartitionsP,
  IntegerPartitionUnrank,
  IntegerPartitionRank,
  IsPartitionOf,
  KPartPartitionCount,
  IntegerPartitionKUnrank,
  IntegerPartitionKRank,
} from "../../../collections/src/families/kernels-combinatorics.ts";
import {
  PartitionsQ,
  DistinctPartitionUnrank,
  DistinctPartitionRank,
  IsDistinctPartitionOf,
  PartitionsInBoxCount,
  PartitionsInBoxUnrank,
  PartitionsInBoxRank,
  IsPartitionInBox,
  PartitionsMaxPartCount,
  PartitionsMaxPartUnrank,
  PartitionsMaxPartRank,
  IsPartitionMaxPart,
} from "../../../collections/src/families/kernels-extra.ts";

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

export const entries: NumberKernel[] = [
  // ── partitions ──
  {
    ...ints(
      "IntegerPartitions",
      1,
      ([n]) => PartitionsP(n),
      ([n], r) => IntegerPartitionUnrank(n, r),
      (a, [n]) => IsPartitionOf(a, n),
      (a, [n]) => IntegerPartitionRank(a, n),
    ),
    carrier: "IntegerPartition",
  },
  {
    ...ints(
      "PartitionsIntoKParts",
      2,
      ([n, k]) => KPartPartitionCount(n, k),
      ([n, k], r) => IntegerPartitionKUnrank(n, k, r),
      (a, [n, k]) => IsPartitionOf(a, n, k),
      (a, [n]) => IntegerPartitionKRank(a, n),
    ),
    carrier: "IntegerPartition",
  },
  {
    ...ints(
      "DistinctPartitions",
      1,
      ([n]) => PartitionsQ(n),
      ([n], r) => DistinctPartitionUnrank(n, r),
      (a, [n]) => IsDistinctPartitionOf(a, n),
      (a, [n]) => DistinctPartitionRank(a, n),
    ),
    carrier: "IntegerPartition",
  },
  {
    ...ints(
      "PartitionsMaxPart",
      2,
      ([n, m]) => PartitionsMaxPartCount(n, m),
      ([n, m], r) => PartitionsMaxPartUnrank(n, m, r),
      (a, [n, m]) => IsPartitionMaxPart(a, n, m),
      (a, [, m]) => PartitionsMaxPartRank(a, m),
    ),
    carrier: "IntegerPartition",
  },
  {
    ...ints(
      "PartitionsInBox",
      2,
      ([a, b]) => PartitionsInBoxCount(a, b),
      ([a, b], r) => PartitionsInBoxUnrank(a, b, r),
      (x, [a, b]) => IsPartitionInBox(x, a, b),
      (x, [a, b]) => PartitionsInBoxRank(x, a, b),
    ),
    carrier: "IntegerPartition",
  },
];
