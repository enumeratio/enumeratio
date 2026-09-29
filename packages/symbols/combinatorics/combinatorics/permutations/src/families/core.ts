// Permutation-area families split out of collections/src/families/core.ts (which mixed every
// area) per https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5: SymmetricGroup (bigint) and the one-line/cyclic/signed/colored permutation families
// (plain-number). The generic kernel math they call (Factorial, IsPermutationOf, the
// KPermutation*/SignedPermutation*/ColoredPermutation*/Involution*/Derangement*/CyclicPermutation*
// primitives) stays in collections/src/families/kernels*.ts — reused across areas, not
// permutations-specific machinery.
import type { FamilyKernel, NumberKernel } from "../../../collections/src/families/types.ts";
import { IsPermutationOf } from "../../../collections/src/families/kernels.ts";
import {
  KPermutationCount,
  KPermutationUnrank,
  KPermutationRank,
  IsKPermutationOf,
  SignedPermutationCount,
  SignedPermutationUnrank,
  SignedPermutationRank,
  IsSignedPermutationOf,
  ColoredPermutationCount,
  ColoredPermutationUnrank,
  ColoredPermutationRank,
  IsColoredPermutationOf,
  InvolutionCount,
  InvolutionUnrank,
  InvolutionRank,
  IsInvolutionOf,
  DerangementCount,
  DerangementUnrank,
  DerangementRank,
  IsDerangementOf,
  CyclicPermutationCount,
  CyclicPermutationUnrank,
  CyclicPermutationRank,
  IsCyclicPermutationOf,
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

const factorialBig = (n: number): bigint => {
  let f = 1n;
  for (let i = 2n; i <= BigInt(n); i++) f *= i;
  return f;
};

// SymmetricGroup(n) in bigint: n! passes 2^53 at n = 19, well inside what a table pages.
// Lex order by Lehmer code, the same order as PermutationUnrank / PermutationRank.
export const bigintEntries: FamilyKernel[] = [
  {
    head: "SymmetricGroup",
    carrier: "Permutation",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => factorialBig(n),
    unrank: ([n], r) => {
      const avail = Array.from({ length: n }, (_, i) => i + 1);
      let rem = r % factorialBig(n);
      const res: number[] = [];
      for (let k = n - 1; k >= 0; k--) {
        const f = factorialBig(k);
        const idx = Number(rem / f);
        rem %= f;
        res.push(avail.splice(idx, 1)[0]);
      }
      return res;
    },
    rank: (element, [n]) => {
      const a = element as number[];
      if (!IsPermutationOf(a, n)) return -1n;
      const avail = Array.from({ length: n }, (_, i) => i + 1);
      let rank = 0n;
      for (let i = 0; i < n; i++) {
        const idx = avail.indexOf(a[i]);
        rank += BigInt(idx) * factorialBig(n - 1 - i);
        avail.splice(idx, 1);
      }
      return rank;
    },
    valid: (a, [n]) => IsPermutationOf(a as number[], n),
  },
];

export const entries: NumberKernel[] = [
  // ── permutations (one-line words) ──
  ints(
    "KPermutations",
    2,
    ([n, k]) => KPermutationCount(n, k),
    ([n, k], r) => KPermutationUnrank(n, k, r),
    (a, [n, k]) => IsKPermutationOf(a, n, k),
    (a, [n]) => KPermutationRank(a, n),
  ),
  ints(
    "SignedPermutations",
    1,
    ([n]) => SignedPermutationCount(n),
    ([n], r) => SignedPermutationUnrank(n, r),
    (a, [n]) => IsSignedPermutationOf(a, n),
    (a) => SignedPermutationRank(a),
  ),
  {
    ...ints(
      "CyclicPermutations",
      1,
      ([n]) => CyclicPermutationCount(n),
      ([n], r) => CyclicPermutationUnrank(n, r),
      (a, [n]) => IsCyclicPermutationOf(a, n),
      (a) => CyclicPermutationRank(a),
    ),
    carrier: "Permutation",
  },
  {
    ...ints(
      "Involutions",
      1,
      ([n]) => InvolutionCount(n),
      ([n], r) => InvolutionUnrank(n, r),
      (a, [n]) => IsInvolutionOf(a, n),
      (a) => InvolutionRank(a),
    ),
    carrier: "Permutation",
  },
  {
    ...ints(
      "Derangements",
      1,
      ([n]) => DerangementCount(n),
      ([n], r) => DerangementUnrank(n, r),
      (a, [n]) => IsDerangementOf(a, n),
      (a) => DerangementRank(a),
    ),
    carrier: "Permutation",
  },
  {
    head: "ColoredPermutations",
    paramCount: 2,
    kind: "blocks",
    count: ([n, k]) => ColoredPermutationCount(n, k),
    unrank: ([n, k], r) => {
      const [img, cols] = ColoredPermutationUnrank(n, k, r);
      return [img, cols];
    },
    valid: (b, [n, k]) => {
      const bb = b as number[][];
      return IsColoredPermutationOf(bb[0] ?? [], bb[1] ?? [], n, k);
    },
    rank: (b, [, k]) => {
      const bb = b as number[][];
      return ColoredPermutationRank(bb[0], bb[1], k);
    },
  },
];
