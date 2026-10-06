// Permutation classes in the symmetric group's lex order. Boolean permutations are Fibonacci
// words in disguise. Grassmannian, Cograssmannian, NonCrossing, Separable and Vexillary are
// completion counts (./restrictions.ts). Baxter, Simple and Smooth still filter all n!
// permutations in lex order (PermutationUnrank) by an independently written predicate, and index
// the filtered list: Simple has no polynomial completion count known to us, and the exact ones for
// Baxter and Smooth have list-valued or exponential state (wiki Speculative-Restrictions).
import { binomial } from "../../../collections/src/families/shared.ts";
import { Factorial, IsPermutationOf, PermutationUnrank } from "../../../collections/src/families/kernels.ts";
import {
  FibonacciWordCount,
  FibonacciWordRank,
  FibonacciWordUnrank,
} from "../../../collections/src/families/kernels-extra.ts";
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  cograssmannianPermutations,
  grassmannianPermutations,
  nonCrossingCycleSupportPermutations,
  separablePermutations,
  vexillaryPermutations,
} from "./restrictions.ts";
import type { Declared, NumberKernel } from "../../../collections/src/families/types.ts";

// helper to cut boilerplate for the flat (number[]) shape; mirrors permutations.ts's private `ints`.
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

// ─── generic enumerate-then-index kernel: all permutations of n, lex order (PermutationUnrank),
// filtered by `predicate`. Cached per n. Rank is a binary search — PermutationUnrank/Rank's factorial-
// number-system order IS array-lexicographic order, so the filtered list stays sorted for free. ───────
function comparePerm(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
function makeBruteForceClass(
  predicate: (perm: readonly number[], n: number) => boolean,
  exactCount?: (n: number) => number,
) {
  const listCache = new Map<number, number[][]>();
  function list(n: number): number[][] {
    const cached = listCache.get(n);
    if (cached) return cached;
    const l: number[][] = [];
    const total = Factorial(n);
    for (let r = 0; r < total; r++) {
      const p = PermutationUnrank(n, r);
      if (predicate(p, n)) l.push(p);
    }
    listCache.set(n, l);
    return l;
  }
  return {
    /** What Plausible reads: it filters all n! permutations to unrank or rank, and to count
     *  too unless a closed count was given. */
    declared: {
      carrier: "Permutation",
      params: [{ name: "size", role: "axis", min: 0 }],
      cost: {
        count: exactCount ? "closed" : "enumerative",
        unrank: "enumerative",
        rank: "enumerative",
        valid: "polynomial",
      },
      work: ([n]: number[]) => BigInt(Factorial(n as number)),
    } satisfies Declared,
    count: (n: number) => (exactCount ? exactCount(n) : list(n).length),
    unrank: (n: number, r: number): number[] => {
      const l = list(n);
      const total = l.length;
      const rr = total ? ((Math.trunc(r) % total) + total) % total : 0;
      return l[rr];
    },
    rank: (perm: readonly number[]): number => {
      const l = list(perm.length);
      let lo = 0;
      let hi = l.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const cmp = comparePerm(l[mid], perm);
        if (cmp === 0) return mid;
        if (cmp < 0) lo = mid + 1;
        else hi = mid - 1;
      }
      return -1;
    },
    valid: (perm: readonly number[], n: number): boolean => IsPermutationOf(perm as number[], n) && predicate(perm, n),
  };
}

// ─── BaxterPermutations(n): avoid the vincular patterns 2-41-3 and 3-14-2 (the "41"/"14" must sit at
// ADJACENT positions) — A001181. Predicate: for every adjacent descent pair (pos,pos+1) with value pair
// (a,b)=(perm[pos],perm[pos+1]), a>b, forbid a "2" to its left and a "3" to its right sandwiched as
// b<left<right<a (2-41-3); for every adjacent ascent pair a<b, forbid a "3" to its left and a "2" to its
// right sandwiched as a<right<left<b (3-14-2). Count uses the classical Chung–Graham–Hoggatt–Kleiman
// rational formula (verified against this predicate by brute force through n=9).
function isBaxterPermutation(perm: readonly number[]): boolean {
  const n = perm.length;
  for (let pos = 0; pos + 1 < n; pos++) {
    const a = perm[pos];
    const b = perm[pos + 1];
    if (a > b) {
      for (let i = 0; i < pos; i++) {
        if (b < perm[i] && perm[i] < a) {
          for (let k = pos + 2; k < n; k++) if (perm[i] < perm[k] && perm[k] < a) return false;
        }
      }
    } else {
      for (let i = 0; i < pos; i++) {
        if (a < perm[i] && perm[i] < b) {
          for (let k = pos + 2; k < n; k++) if (a < perm[k] && perm[k] < perm[i]) return false;
        }
      }
    }
  }
  return true;
}
function baxterCount(n: number): number {
  if (n <= 1) return 1;
  let sum = 0;
  for (let k = 0; k <= n - 1; k++) sum += binomial(n + 1, k) * binomial(n + 1, k + 1) * binomial(n + 1, k + 2);
  return Math.round(sum / (binomial(n + 1, 1) * binomial(n + 1, 2)));
}
const baxterClass = makeBruteForceClass((p) => isBaxterPermutation(p), baxterCount);

// ─── AdjacentTranspositionInvolutions(n): "no non-adjacent inversion" — every inversion (i<j, perm[i]>perm[j]) has
// j=i+1. Such a permutation is exactly a product of pairwise-non-adjacent adjacent transpositions
// (i,i+1) applied to the identity (two adjacent transpositions that were themselves adjacent wouldn't
// commute and would create a longer-range inversion) — a bijection with independent sets of the path
// graph on {1,…,n−1}, i.e. exactly a FibonacciWord (kernels-extra.ts) of length n−1. Count F(n+1),
// A000045.
function booleanCount(n: number): number {
  return n <= 1 ? 1 : FibonacciWordCount(n - 1);
}
function booleanWordToPermutation(word: readonly number[]): number[] {
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
function booleanUnrank(n: number, r: number): number[] {
  if (n <= 1) return PermutationUnrank(n, 0);
  return booleanWordToPermutation(FibonacciWordUnrank(n - 1, r));
}
function isBooleanPermutation(perm: readonly number[]): boolean {
  const n = perm.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (perm[i] > perm[j] && j !== i + 1) return false;
  return true;
}
function booleanRank(perm: readonly number[]): number {
  const n = perm.length;
  if (n <= 1) return 0;
  const word: number[] = [];
  for (let i = 0; i < n - 1; i++) word.push(perm[i] > perm[i + 1] ? 1 : 0);
  return FibonacciWordRank(word);
}

// ─── NonCrossingCycleSupportPermutations(n): cycles forming a non-crossing partition, by completion counts
// (./restrictions.ts).

// ─── BooleanPermutations(n): Tenner's Boolean permutations, Av(321, 3412) — the permutations whose
// principal Bruhat ideal is a Boolean lattice, A001519: F(2n − 1) (1, 1, 2, 5, 13, 34, …). Enumerated by
// filtering all n! permutations, like Baxter; the count is closed.
function isBooleanPermutationOfTenner(perm: readonly number[]): boolean {
  return !containsAnyPattern3(perm, ["321"]) && !containsAnyPattern4(perm, ["3412"]);
}
function booleanTennerCount(n: number): number {
  if (n === 0) return 1;
  let [a, b] = [0, 1]; // F(0), F(1)
  for (let i = 1; i < 2 * n - 1; i++) [a, b] = [b, a + b];
  return b; // F(2n − 1)
}
const booleanTennerClass = makeBruteForceClass((p) => isBooleanPermutationOfTenner(p), booleanTennerCount);

// ─── NonCrossingPermutations(n): the permutations below the long cycle c = (1 2 … n) in absolute order
// (Biane, Kreweras): ℓ_T(π) + ℓ_T(π⁻¹c) = ℓ_T(c) = n − 1, with ℓ_T = n − cycles. Each is a non-crossing
// partition with every block an increasing cycle; Catalan(n). Filtered from all n! permutations.
function cycleCountOf(perm: readonly number[]): number {
  const seen = new Array<boolean>(perm.length).fill(false);
  let cycles = 0;
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    cycles++;
    for (let j = i; !seen[j]; j = perm[j] - 1) seen[j] = true;
  }
  return cycles;
}
function isBelowLongCycle(perm: readonly number[]): boolean {
  const n = perm.length;
  if (n === 0) return true;
  const inverse = new Array<number>(n);
  for (let i = 0; i < n; i++) inverse[perm[i] - 1] = i + 1;
  // π⁻¹c: i ↦ π⁻¹(i + 1 mod n)
  const rest = Array.from({ length: n }, (_, i) => inverse[(i + 1) % n]);
  return cycleCountOf(perm) + cycleCountOf(rest) === n + 1;
}
const nonCrossingClass = makeBruteForceClass(isBelowLongCycle, (n) => catalanNumber(n));
function catalanNumber(n: number): number {
  return Math.round(binomial(2 * n, n) / (n + 1));
}

// ─── length-4 vincular-free (classical) pattern helpers shared by Separable/Smooth/Vexillary. ────────
function patternOf4(a: number, b: number, c: number, d: number): string {
  const sorted = [a, b, c, d];
  sorted.sort((x, y) => x - y);
  return [a, b, c, d].map((v) => sorted.indexOf(v) + 1).join("");
}
function containsAnyPattern3(perm: readonly number[], patterns: readonly string[]): boolean {
  const n = perm.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const [a, b, c] = [perm[i], perm[j], perm[k]];
        const pattern = `${1 + (b < a ? 1 : 0) + (c < a ? 1 : 0)}${1 + (a < b ? 1 : 0) + (c < b ? 1 : 0)}${1 + (a < c ? 1 : 0) + (b < c ? 1 : 0)}`;
        if (patterns.includes(pattern)) return true;
      }
  return false;
}
function containsAnyPattern4(perm: readonly number[], patterns: readonly string[]): boolean {
  const n = perm.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        for (let l = k + 1; l < n; l++)
          if (patterns.includes(patternOf4(perm[i], perm[j], perm[k], perm[l]))) return true;
  return false;
}

// ─── SeparablePermutations(n): Av(2413,3142), by completion counts (./restrictions.ts).

// ─── SimplePermutations(n): no non-trivial interval (a contiguous run of positions whose values form a
// contiguous range, other than a single position or the whole permutation) — A111111. No closed-form
// count implemented; count is the enumeration's own length (exact, verified against A111111 through
// n=8: 1,2,0,2,6,46,338,2926).
function hasNonTrivialInterval(perm: readonly number[]): boolean {
  const n = perm.length;
  for (let i = 0; i < n; i++)
    for (let len = 2; len < n; len++) {
      if (i + len > n) continue;
      let mn = Infinity;
      let mx = -Infinity;
      for (let t = i; t < i + len; t++) {
        if (perm[t] < mn) mn = perm[t];
        if (perm[t] > mx) mx = perm[t];
      }
      if (mx - mn === len - 1) return true;
    }
  return false;
}
const simpleClass = makeBruteForceClass((p) => !hasNonTrivialInterval(p));

// ─── SmoothPermutations(n): Av(3412,4231) — the σ whose Schubert variety is smooth, A032351 (Bóna
// 1998; algebraic, non-rational generating function — no simple closed-form unrank).
const smoothClass = makeBruteForceClass((p) => !containsAnyPattern4(p, ["3412", "4231"]));

export const entries: (NumberKernel | EpsilFamily)[] = [
  {
    ...ints(
      "BooleanPermutations",
      1,
      ([n]) => booleanTennerClass.count(n),
      ([n], r) => booleanTennerClass.unrank(n, r),
      (a, [n]) => booleanTennerClass.valid(a, n),
      (a) => booleanTennerClass.rank(a),
    ),
    declared: booleanTennerClass.declared,
    carrier: "Permutation",
  },
  {
    ...ints(
      "NonCrossingPermutations",
      1,
      ([n]) => nonCrossingClass.count(n),
      ([n], r) => nonCrossingClass.unrank(n, r),
      (a, [n]) => nonCrossingClass.valid(a, n),
      (a) => nonCrossingClass.rank(a),
    ),
    declared: nonCrossingClass.declared,
    carrier: "Permutation",
  },
  {
    ...ints(
      "BaxterPermutations",
      1,
      ([n]) => baxterClass.count(n),
      ([n], r) => baxterClass.unrank(n, r),
      (a, [n]) => baxterClass.valid(a, n),
      (a) => baxterClass.rank(a),
    ),
    declared: baxterClass.declared,
    carrier: "Permutation",
  },
  {
    ...ints(
      "AdjacentTranspositionInvolutions",
      1,
      ([n]) => booleanCount(n),
      ([n], r) => booleanUnrank(n, r),
      (a, [n]) => IsPermutationOf(a, n) && isBooleanPermutation(a),
      (a) => booleanRank(a),
    ),
    carrier: "Permutation",
  },
  grassmannianPermutations,
  cograssmannianPermutations,
  nonCrossingCycleSupportPermutations,
  separablePermutations,
  {
    ...ints(
      "SimplePermutations",
      1,
      ([n]) => simpleClass.count(n),
      ([n], r) => simpleClass.unrank(n, r),
      (a, [n]) => simpleClass.valid(a, n),
      (a) => simpleClass.rank(a),
    ),
    declared: simpleClass.declared,
    carrier: "Permutation",
  },
  {
    ...ints(
      "SmoothPermutations",
      1,
      ([n]) => smoothClass.count(n),
      ([n], r) => smoothClass.unrank(n, r),
      (a, [n]) => smoothClass.valid(a, n),
      (a) => smoothClass.rank(a),
    ),
    declared: smoothClass.declared,
    carrier: "Permutation",
  },
  vexillaryPermutations,
];
