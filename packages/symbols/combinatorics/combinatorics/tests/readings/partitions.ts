// The partitions families' TS kernels, read in the order their Epsil definitions list. They answered ahead of Epsil
// until compiled Epsil made that unnecessary (BL-225); tests/fast-kernels.test.ts holds them to the definitions.
import type { FastKernel } from "../../collections/src/families/epsil.ts";
import {
  IsPartitionInBox,
  PartitionsInBoxCount,
  PartitionsInBoxRank,
  PartitionsInBoxUnrank,
} from "./kernels/collections-kernels-extra.ts";

export const readings: Record<string, FastKernel> = {
  PartitionsInBox: {
    count: ([a, b]) => PartitionsInBoxCount(a, b),
    unrank: ([a, b], r) => PartitionsInBoxUnrank(a, b, r),
    rank: (x, [a, b]) => PartitionsInBoxRank(x as number[], a, b),
    valid: (x, [a, b]) => IsPartitionInBox(x as number[], a, b),
  },
};
