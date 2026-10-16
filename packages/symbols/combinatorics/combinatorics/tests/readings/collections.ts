// The collections families' TS kernels, read in the order their Epsil definitions list. They answered
// ahead of Epsil until compiled Epsil made that unnecessary (BL-225); tests/fast-kernels.test.ts holds
// them to the definitions.
import type { FastKernel } from "../../collections/src/families/epsil.ts";
import { fibonacciWordsExact, triStringsExact } from "../../collections/src/families/exact-recurrences.ts";
import { triRank, triUnrank, triValid } from "./kernels/collections-binary-word-families.ts";
import {
  BinaryStringCount,
  BinaryStringRank,
  BinaryStringUnrank,
  FibonacciWordRank,
  FibonacciWordUnrank,
  GrayCodeSubsetRank,
  GrayCodeSubsetUnrank,
  IsBinaryString,
  IsFibonacciWord,
  IsLatticePathOf,
  IsMultisetOf,
  IsTupleOf,
  LatticePathCount,
  LatticePathRank,
  LatticePathUnrank,
  MultisetCount,
  MultisetRank,
  MultisetUnrank,
  SubsetCount,
  TupleCount,
  TupleRank,
  TupleUnrank,
  IsSubsetOf,
} from "./kernels/collections-kernels-extra.ts";
import { finePathsFast, grandDyckPathsFast, riordanPathsFast } from "./kernels/collections-paths-partitions.ts";
import { recursiveTreesFast, sytHookShapeFast } from "./kernels/collections-tableaux-trees.ts";

export const readings: Record<string, FastKernel> = {
  GrayCodeSubsets: {
    count: ([n]) => SubsetCount(n),
    unrank: ([n], r) => GrayCodeSubsetUnrank(n, r),
    rank: (x) => GrayCodeSubsetRank(x as number[]),
    valid: (x, [n]) => IsSubsetOf(x as number[], n),
  },
  Multisets: {
    count: ([n, k]) => MultisetCount(n, k),
    unrank: ([n, k], r) => MultisetUnrank(n, k, r),
    rank: (x) => MultisetRank(x as number[]),
    valid: (x, [n, k]) => IsMultisetOf(x as number[], n, k),
  },
  Tuples: {
    count: ([n, k]) => TupleCount(n, k),
    unrank: ([n, k], r) => TupleUnrank(n, k, r),
    rank: (x, [n]) => TupleRank(x as number[], n),
    valid: (x, [n, k]) => IsTupleOf(x as number[], n, k),
  },
  BinaryStrings: {
    count: ([n]) => BinaryStringCount(n),
    unrank: ([n], r) => BinaryStringUnrank(n, r),
    rank: (x) => BinaryStringRank(x as number[]),
    valid: (x, [n]) => IsBinaryString(x as number[], n),
  },
  LatticePaths: {
    count: ([a, b]) => LatticePathCount(a, b),
    unrank: ([a, b], r) => LatticePathUnrank(a, b, r),
    rank: (x) => LatticePathRank(x as number[]),
    valid: (x, [a, b]) => IsLatticePathOf(x as number[], a, b),
  },
  FibonacciWords: {
    count: ([n]) => fibonacciWordsExact(n),
    unrank: ([n], r) => FibonacciWordUnrank(n, r),
    rank: (x) => FibonacciWordRank(x as number[]),
    valid: (x, [n]) => IsFibonacciWord(x as number[], n),
  },
  TriStrings: {
    count: ([n]) => triStringsExact(n),
    unrank: ([n], r) => triUnrank(n, r),
    rank: (a, [n]) => triRank(a as number[], n),
    valid: (a, [n]) => triValid(a, n),
  },
  GrandDyckPaths: grandDyckPathsFast,
  RiordanPaths: riordanPathsFast,
  FinePaths: finePathsFast,
  RecursiveTrees: recursiveTreesFast,
  SytHookShape: sytHookShapeFast,
};
