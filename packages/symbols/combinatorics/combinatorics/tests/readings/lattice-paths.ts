// The lattice-path families' TS kernels, read in the order their Epsil definitions list. They answered
// ahead of Epsil until compiled Epsil made that unnecessary (BL-225); tests/fast-kernels.test.ts holds
// them to the definitions as independent readings.
import type { FastKernel } from "../../collections/src/families/epsil.ts";
import { motzkinExact, schroederExact } from "../../collections/src/families/exact-recurrences.ts";
import { CatalanNumber, DyckPathRank, DyckPathUnrank } from "../../collections/src/families/kernels-extra.ts";
import {
  DyckPathCount,
  IsDyckPath,
  IsMotzkinPath,
  IsSchroederPath,
  MotzkinRank,
  MotzkinUnrank,
  SchroederRank,
  SchroederUnrank,
} from "./kernels/collections-kernels-extra.ts";
import {
  DelannoyPathCount,
  DelannoyPathRank,
  DelannoyPathUnrank,
  isDelannoyPathOf,
  isLukasiewiczPathOf,
  LukasiewiczPathRank,
  LukasiewiczPathUnrank,
} from "./kernels/lattice-paths-paths-partitions.ts";

export const readings: Record<string, FastKernel> = {
  DyckPaths: {
    count: ([n]) => DyckPathCount(n),
    unrank: ([n], r) => DyckPathUnrank(n, r),
    rank: (x) => DyckPathRank(x as number[]),
    valid: (x, [n]) => IsDyckPath(x as number[], n),
  },
  MotzkinPaths: {
    count: ([n]) => motzkinExact(n),
    unrank: ([n], r) => MotzkinUnrank(n, r),
    rank: (x) => MotzkinRank(x as number[]),
    valid: (x, [n]) => IsMotzkinPath(x as number[], n),
  },
  SchroederPaths: {
    count: ([n]) => schroederExact(n),
    unrank: ([n], r) => SchroederUnrank(n, r),
    rank: (x) => SchroederRank(x as number[]),
    valid: (x, [n]) => IsSchroederPath(x as number[], n),
  },
  DelannoyPaths: {
    count: ([n]) => DelannoyPathCount(n),
    unrank: ([n], r) => DelannoyPathUnrank(n, r),
    rank: (x, [n]) => DelannoyPathRank(x as number[], n),
    valid: (x, [n]) => isDelannoyPathOf(x, n),
  },
  LukasiewiczPaths: {
    count: ([n]) => CatalanNumber(n),
    unrank: ([n], r) => LukasiewiczPathUnrank(n, r),
    rank: (x) => LukasiewiczPathRank(x as number[]),
    valid: (x, [n]) => isLukasiewiczPathOf(x, n),
  },
};
