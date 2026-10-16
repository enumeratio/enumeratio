// The permutations families' TS kernels, read in the order their Epsil definitions list. They answered ahead of Epsil
// until compiled Epsil made that unnecessary (BL-225); tests/fast-kernels.test.ts holds them to the definitions.
import type { FastKernel } from "../../collections/src/families/epsil.ts";
import {
  Factorial,
  IsPermutationOf,
  PermutationRank,
  PermutationUnrank,
} from "../../collections/src/families/kernels.ts";
import { telephoneExact } from "../../collections/src/families/exact-triangles.ts";
import { mahonianNumber } from "../../permutations/src/mahonian.ts";
import {
  ColoredPermutationCount,
  ColoredPermutationRank,
  ColoredPermutationUnrank,
  IsColoredPermutationOf,
  IsKPermutationOf,
  IsSignedPermutationOf,
  KPermutationCount,
  KPermutationRank,
  KPermutationUnrank,
  SignedPermutationCount,
  SignedPermutationRank,
  SignedPermutationUnrank,
} from "./kernels/collections-kernels-extra.ts";
import { Inversions, LehmerCode } from "./kernels/collections-kernels.ts";
import { isInvolutionPermutation } from "./kernels/collections-exact-triangles.ts";
import {
  booleanCount,
  booleanRank,
  booleanUnrank,
  isBooleanPermutation,
} from "./kernels/permutations-permutation-classes.ts";
import {
  evenPermutationCount,
  evenPermutationUnrank,
  isEvenPermutation,
  isSubexcedant,
  isValidLehmerCode,
  kInversionRank,
  kInversionUnrank,
  permutationFromLehmerCode,
  subexcedantRank,
  subexcedantUnrank,
  withinMahonianTable,
} from "./kernels/permutations-permutations.ts";

/** KPermutations and, under another name, Arrangements. */
const kPermutations: FastKernel = {
  count: ([n, k]) => (k > n ? 0 : KPermutationCount(n, k)),
  unrank: ([n, k], r) => KPermutationUnrank(n, k, r),
  rank: (x, [n]) => KPermutationRank(x as number[], n),
  valid: (x, [n, k]) => IsKPermutationOf(x as number[], n, k),
};

export const readings: Record<string, FastKernel> = {
  SymmetricGroup: {
    count: ([n]) => Factorial(n),
    unrank: ([n], r) => PermutationUnrank(n, r),
    rank: (x) => PermutationRank(x as number[]),
    valid: (x, [n]) => IsPermutationOf(x as number[], n),
  },
  KPermutations: kPermutations,
  SignedPermutations: {
    count: ([n]) => SignedPermutationCount(n),
    unrank: ([n], r) => SignedPermutationUnrank(n, r),
    rank: (x) => SignedPermutationRank(x as number[]),
    valid: (x, [n]) => IsSignedPermutationOf(x as number[], n),
  },
  ColoredPermutations: {
    count: ([n, k]) => ColoredPermutationCount(n, k),
    unrank: ([n, k], r) => ColoredPermutationUnrank(n, k, r),
    rank: (x, [, k]) => {
      const [image, colours] = x as number[][];
      return ColoredPermutationRank(image, colours, k);
    },
    valid: (x, [n, k]) => {
      const [image, colours] = x as number[][];
      return (x as number[][]).length === 2 && IsColoredPermutationOf(image, colours, n, k);
    },
  },
  Arrangements: kPermutations,
  EvenPermutations: {
    count: ([n]) => evenPermutationCount(n),
    unrank: ([n], r) => evenPermutationUnrank(n, r),
    rank: (x) => Math.floor(PermutationRank(x as number[]) / 2),
    valid: (x, [n]) => isEvenPermutation(x as number[], n),
  },
  LehmerCodes: {
    count: ([n]) => Factorial(n),
    unrank: ([n], r) => LehmerCode(PermutationUnrank(n, r)),
    rank: (x, [n]) => PermutationRank(permutationFromLehmerCode(x as number[], n)),
    valid: (x, [n]) => isValidLehmerCode(x as number[], n),
  },
  SubexcedantSeqs: {
    count: ([n]) => Factorial(n),
    unrank: ([n], r) => subexcedantUnrank(n, r),
    rank: (x, [n]) => subexcedantRank(x as number[], n),
    valid: (x, [n]) => isSubexcedant(x as number[], n),
  },
  KInversionPermutations: {
    count: ([n, k]) => mahonianNumber(BigInt(n), BigInt(k)),
    unrank: ([n, k], r) => kInversionUnrank(withinMahonianTable(n), k, r),
    rank: (x, [n]) => kInversionRank(x as number[], withinMahonianTable(n)),
    valid: (x, [n, k]) => IsPermutationOf(x as number[], n) && Inversions(x as number[]) === k,
  },
  AdjacentTranspositionInvolutions: {
    count: ([n]) => booleanCount(n),
    unrank: ([n], r) => booleanUnrank(n, r),
    rank: (x) => booleanRank(x as number[]),
    valid: (x, [n]) => IsPermutationOf(x as number[], n) && isBooleanPermutation(x as number[]),
  },
  // A count and a membership test only: the unrank and rank are Epsil's.
  Involutions: {
    count: ([n]) => (n > 5000 ? undefined : telephoneExact(n)),
    unrank: () => undefined,
    rank: () => undefined,
    valid: isInvolutionPermutation,
  },
};
