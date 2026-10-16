// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { PermutationUnrank } from "../../../collections/src/families/kernels.ts";
import { FibonacciWordCount, FibonacciWordRank, FibonacciWordUnrank } from "./collections-kernels-extra.ts";

export function isBooleanPermutation(perm: readonly number[]): boolean {
  const n = perm.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (perm[i] > perm[j] && j !== i + 1) return false;
  return true;
}

export function booleanRank(perm: readonly number[]): number {
  const n = perm.length;
  if (n <= 1) return 0;
  const word: number[] = [];
  for (let i = 0; i < n - 1; i++) word.push(perm[i] > perm[i + 1] ? 1 : 0);
  return FibonacciWordRank(word);
}

export function booleanWordToPermutation(word: readonly number[]): number[] {
  const n = word.length + 1;
  const perm = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = 0; i < word.length; i++) {
    if (word[i] === 1) {
      const t = perm[i];
      perm[i] = perm[i + 1];
      perm[i + 1] = t;
    }
  }
  return perm;
}

export function booleanUnrank(n: number, r: number): number[] {
  if (n <= 1) return PermutationUnrank(n, 0);
  return booleanWordToPermutation(FibonacciWordUnrank(n - 1, r));
}

// ─── AdjacentTranspositionInvolutions(n): "no non-adjacent inversion" — every inversion (i<j, perm[i]>perm[j]) has
// j=i+1. Such a permutation is exactly a product of pairwise-non-adjacent adjacent transpositions
// (i,i+1) applied to the identity (two adjacent transpositions that were themselves adjacent wouldn't
// commute and would create a longer-range inversion) — a bijection with independent sets of the path
// graph on {1,…,n−1}, i.e. exactly a FibonacciWord (kernels-extra.ts) of length n−1. Count F(n+1),
// A000045.
export function booleanCount(n: number): number {
  return n <= 1 ? 1 : FibonacciWordCount(n - 1);
}
