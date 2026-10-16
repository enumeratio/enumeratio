// The words families' TS kernels, read in the order their Epsil definitions list. They answered ahead of Epsil
// until compiled Epsil made that unnecessary (BL-225); tests/fast-kernels.test.ts holds them to the definitions.
import type { FastKernel } from "../../collections/src/families/epsil.ts";
import {
  BinaryStringCount,
  BinaryStringRank,
  BinaryStringUnrank,
  IsBinaryString,
  IsTupleOf,
  TupleCount,
  TupleRank,
  TupleUnrank,
} from "./kernels/collections-kernels-extra.ts";
import {
  FibonacciWordCount,
  FibonacciWordRank,
  FibonacciWordUnrank,
  IsFibonacciWord,
} from "./kernels/collections-kernels-extra.ts";
import { stirlingCount, stirlingRank, stirlingUnrank, stirlingValid } from "./kernels/words-binary-word-families.ts";
import {
  byWeightCount,
  byWeightRank,
  byWeightUnrank,
  byWeightValid,
  lucasCount,
  lucasStringsRank,
  lucasStringsUnrank,
  lucasStringsValid,
} from "./kernels/words-words.ts";
import {
  grayCodeCount,
  grayCodeRank,
  grayCodeUnrank,
  palindromeCount,
  palindromeRank,
  palindromeUnrank,
  palindromeValid,
} from "./kernels/words-words.ts";

export const readings: Record<string, FastKernel> = {
  Endofunctions: {
    count: ([n]) => TupleCount(n, n),
    unrank: ([n], r) => TupleUnrank(n, n, r),
    rank: (x, [n]) => TupleRank(x as number[], n),
    valid: (x, [n]) => IsTupleOf(x as number[], n, n),
  },
  BinaryWords: {
    count: ([n]) => BinaryStringCount(n),
    unrank: ([n], r) => BinaryStringUnrank(n, r),
    rank: (x) => BinaryStringRank(x as number[]),
    valid: (x, [n]) => IsBinaryString(x as number[], n),
  },
  Words: {
    count: ([size, base]) => TupleCount(base, size),
    unrank: ([size, base], r) => TupleUnrank(base, size, r),
    rank: (x, [, base]) => TupleRank(x as number[], base),
    valid: (x, [size, base]) => IsTupleOf(x as number[], base, size),
  },
  GrayCodes: {
    count: ([n]) => grayCodeCount(n),
    unrank: ([n], r) => grayCodeUnrank(n, r),
    rank: (x) => grayCodeRank(x as number[]),
    valid: (x, [n]) => (x as number[]).length === n && (x as number[]).every((b) => b === 0 || b === 1),
  },
  BinaryPalindromes: {
    count: ([n]) => palindromeCount(n),
    unrank: ([n], r) => palindromeUnrank(n, r),
    rank: (x, [n]) => palindromeRank(x as number[], n),
    valid: (x, [n]) => palindromeValid(x, n),
  },
  BinaryWordsByWeight: {
    count: ([n, k]) => byWeightCount(n, k),
    unrank: ([n, k], r) => byWeightUnrank(n, k, r),
    rank: (x, [n, k]) => byWeightRank(x as number[], n, k),
    valid: (x, [n, k]) => byWeightValid(x, n, k),
  },
  FibStrings: {
    count: ([n]) => FibonacciWordCount(n),
    unrank: ([n], r) => FibonacciWordUnrank(n, r),
    rank: (x) => FibonacciWordRank(x as number[]),
    valid: (x, [n]) => IsFibonacciWord(x as number[], n),
  },
  LucasStrings: {
    count: ([n]) => lucasCount(n),
    unrank: ([n], r) => lucasStringsUnrank(n, r),
    rank: (x, [n]) => lucasStringsRank(x as number[], n),
    valid: (x, [n]) => lucasStringsValid(x, n),
  },
  StirlingPermutations: {
    count: ([n]) => stirlingCount(n),
    unrank: ([n], r) => stirlingUnrank(n, r),
    rank: (x, [n]) => stirlingRank(x as number[], n),
    valid: (x, [n]) => stirlingValid(x, n),
  },
};
