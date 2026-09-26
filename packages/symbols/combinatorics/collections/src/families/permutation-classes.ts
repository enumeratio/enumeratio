// Permutation-class families (catalogued in packages/catalog/src/catalog-data.ts, carrier
// "Permutations") that were never wired to a kernel: Baxter/Boolean/Grassmannian/Cograssmannian/
// NonCrossing/Separable/Simple/Smooth/Vexillary permutations. Reuses ./kernels.ts and
// ./kernels-extra.ts wherever the element representation already matches (Boolean permutations are
// literally Fibonacci words in disguise; Grassmannian/Cograssmannian are k-subsets in disguise).
// Baxter, NonCrossing, Separable, Simple, Smooth and Vexillary have no simple closed-form unrank —
// each is instead an enumerate-then-index kernel: generate all n! permutations in lex order
// (PermutationUnrank), filter by an independently-written membership predicate, and index into the
// filtered, still-lex-sorted list. `count()` uses a closed-form/recurrence where one is known
// (Baxter's rational formula, a verified noncrossing-partition recurrence, Separable's reuse of
// SchroederCount); Simple/Smooth/Vexillary have no closed form implemented here, so count is the
// enumeration's own length — exact, just not sub-factorial.
import { binomial } from "./shared.ts";
import { Factorial, IsPermutationOf, PermutationUnrank } from "./kernels.ts";
import {
  FibonacciWordCount,
  FibonacciWordRank,
  FibonacciWordUnrank,
  KSubsetRank,
  KSubsetUnrank,
  SchroederCount,
} from "./kernels-extra.ts";
import type { Declared, NumberKernel } from "./types.ts";

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
      carrier: "Permutations",
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

// ─── BooleanPermutations(n): "no non-adjacent inversion" — every inversion (i<j, perm[i]>perm[j]) has
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

// ─── GrassmannianPermutations(n): at most one descent — 2ⁿ−n, A000325. Any permutation with ≤1 descent
// is the sorted-ascending concatenation of a "first block" value-set A and its sorted-ascending
// complement, split at the descent; conversely every subset A of [n] gives such a permutation, EXCEPT
// that all n+1 "prefix" subsets A={1,…,k} (k=0,…,n) collapse to the same permutation, the identity. Fix
// the identity's canonical preimage at A=∅ (rank 0) and, for each size k=1,…,n−1, skip subset-rank 0
// (KSubsetUnrank's colex order puts the prefix {1,…,k} at rank 0) — 2ⁿ − (n+1) + 1 = 2ⁿ−n distinct
// permutations, one A=[n] (k=n, all-prefix) dropped entirely since the identity is already covered.
function descentCount(perm: readonly number[]): number {
  let c = 0;
  for (let i = 0; i + 1 < perm.length; i++) if (perm[i] > perm[i + 1]) c++;
  return c;
}
function ascentCount(perm: readonly number[]): number {
  let c = 0;
  for (let i = 0; i + 1 < perm.length; i++) if (perm[i] < perm[i + 1]) c++;
  return c;
}
function grassmannianCount(n: number): number {
  return 2 ** n - n;
}
function buildFromFirstBlock(n: number, block: readonly number[]): number[] {
  const inBlock = new Set(block);
  const rest: number[] = [];
  for (let v = 1; v <= n; v++) if (!inBlock.has(v)) rest.push(v);
  return [...block, ...rest];
}
function grassmannianUnrank(n: number, r: number): number[] {
  const total = grassmannianCount(n);
  let rr = total ? ((Math.trunc(r) % total) + total) % total : 0;
  if (rr === 0) return PermutationUnrank(n, 0); // identity, A = ∅
  rr -= 1;
  for (let k = 1; k <= n - 1; k++) {
    const countK = binomial(n, k) - 1; // exclude the prefix subset {1,…,k}
    if (rr < countK) return buildFromFirstBlock(n, KSubsetUnrank(n, k, rr + 1));
    rr -= countK;
  }
  throw new Error(`grassmannianUnrank: rank out of range for n=${n}`);
}
function isGrassmannian(perm: readonly number[], n: number): boolean {
  return IsPermutationOf(perm as number[], n) && descentCount(perm) <= 1;
}
function grassmannianRank(perm: readonly number[]): number {
  const n = perm.length;
  let d = -1;
  for (let i = 0; i + 1 < n; i++)
    if (perm[i] > perm[i + 1]) {
      d = i;
      break;
    }
  if (d === -1) return 0; // identity
  const k = d + 1;
  const idx = KSubsetRank(perm.slice(0, k));
  let rank = 1;
  for (let kk = 1; kk < k; kk++) rank += binomial(n, kk) - 1;
  return rank + (idx - 1);
}

// ─── CograssmannianPermutations(n): at most one ascent — the complement (v ↦ n+1−v) of a Grassmannian
// permutation, since complementing turns every descent into an ascent and vice versa. Same count 2ⁿ−n.
function permutationComplement(perm: readonly number[]): number[] {
  const n = perm.length;
  return perm.map((v) => n + 1 - v);
}
function cograssmannianUnrank(n: number, r: number): number[] {
  return permutationComplement(grassmannianUnrank(n, r));
}
function isCograssmannian(perm: readonly number[], n: number): boolean {
  return IsPermutationOf(perm as number[], n) && ascentCount(perm) <= 1;
}
function cograssmannianRank(perm: readonly number[]): number {
  return grassmannianRank(permutationComplement(perm));
}

// ─── NonCrossingPermutations(n): permutations whose cycles, read as a set partition of [n], form a
// non-crossing partition (no a<b<c<d with a,c in one block and b,d in a distinct block). Recurrence:
// the block containing 1 has some size k (1≤k≤n); its k elements split the remaining n−k into k ordered
// "gaps" (immediately after each block member), each independently a smaller non-crossing permutation
// (relabeled) — crossing would otherwise force two gaps' elements into different blocks incompatibly.
// The block itself, as a cycle on k labels, has (k−1)! distinct cyclic orderings. f(n) = Σ_k (k−1)!·
// [Σ over compositions g₁+…+g_k=n−k of Πf(gᵢ)]; verified against a direct O(n⁴) brute-force crossing
// check through n=10 (no OEIS match confirmed here, so none is cited — only the verified recurrence).
const ncF = new Map<number, number>();
const ncH = new Map<string, number>();
function nonCrossingF(n: number): number {
  if (n === 0) return 1;
  const cached = ncF.get(n);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let k = 1; k <= n; k++) total += Factorial(k - 1) * nonCrossingH(n - k, k);
  ncF.set(n, total);
  return total;
}
function nonCrossingH(m: number, k: number): number {
  if (k === 0) return m === 0 ? 1 : 0;
  const key = `${m},${k}`;
  const cached = ncH.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let g = 0; g <= m; g++) total += nonCrossingF(g) * nonCrossingH(m - g, k - 1);
  ncH.set(key, total);
  return total;
}
function cyclesOf(perm: readonly number[]): number[][] {
  const n = perm.length;
  const seen: boolean[] = Array.from({ length: n + 1 }, () => false);
  const cycles: number[][] = [];
  for (let s = 1; s <= n; s++) {
    if (seen[s]) continue;
    const cyc: number[] = [];
    let cur = s;
    while (!seen[cur]) {
      seen[cur] = true;
      cyc.push(cur);
      cur = perm[cur - 1];
    }
    cycles.push(cyc);
  }
  return cycles;
}
function isNonCrossingCycles(perm: readonly number[]): boolean {
  const n = perm.length;
  const cycles = cyclesOf(perm);
  const blockOf: number[] = Array.from({ length: n + 1 }, () => -1);
  cycles.forEach((c, bi) => c.forEach((x) => (blockOf[x] = bi)));
  for (let a = 1; a <= n; a++)
    for (let b = a + 1; b <= n; b++)
      for (let c = b + 1; c <= n; c++)
        for (let d = c + 1; d <= n; d++)
          if (blockOf[a] === blockOf[c] && blockOf[b] === blockOf[d] && blockOf[a] !== blockOf[b]) return false;
  return true;
}
const nonCrossingClass = makeBruteForceClass((p) => isNonCrossingCycles(p), nonCrossingF);

// ─── length-4 vincular-free (classical) pattern helpers shared by Separable/Smooth/Vexillary. ────────
function patternOf4(a: number, b: number, c: number, d: number): string {
  const sorted = [a, b, c, d].slice().sort((x, y) => x - y);
  return [a, b, c, d].map((v) => sorted.indexOf(v) + 1).join("");
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

// ─── SeparablePermutations(n): Av(2413,3142) — the large Schröder numbers, A006318. |Separable(n)| =
// SchroederCount(n−1) (kernels-extra.ts's SchroederCount(m) is already certified against Schröder
// paths of semilength m, and is offset by one from permutation size here — verified against this
// predicate by brute force through n=7). No simple closed-form unrank of the *permutation* itself is
// implemented, so unrank/rank enumerate-then-index.
const separableClass = makeBruteForceClass(
  (p) => !containsAnyPattern4(p, ["2413", "3142"]),
  (n) => (n <= 0 ? 1 : SchroederCount(n - 1)),
);

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

// ─── VexillaryPermutations(n): Av(2143) — A005802.
const vexillaryClass = makeBruteForceClass((p) => !containsAnyPattern4(p, ["2143"]));

export const entries: NumberKernel[] = [
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
  },
  ints(
    "BooleanPermutations",
    1,
    ([n]) => booleanCount(n),
    ([n], r) => booleanUnrank(n, r),
    (a, [n]) => IsPermutationOf(a, n) && isBooleanPermutation(a),
    (a) => booleanRank(a),
  ),
  ints(
    "GrassmannianPermutations",
    1,
    ([n]) => grassmannianCount(n),
    ([n], r) => grassmannianUnrank(n, r),
    (a, [n]) => isGrassmannian(a, n),
    (a) => grassmannianRank(a),
  ),
  ints(
    "CograssmannianPermutations",
    1,
    ([n]) => grassmannianCount(n),
    ([n], r) => cograssmannianUnrank(n, r),
    (a, [n]) => isCograssmannian(a, n),
    (a) => cograssmannianRank(a),
  ),
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
  },
  {
    ...ints(
      "SeparablePermutations",
      1,
      ([n]) => separableClass.count(n),
      ([n], r) => separableClass.unrank(n, r),
      (a, [n]) => separableClass.valid(a, n),
      (a) => separableClass.rank(a),
    ),
    declared: separableClass.declared,
  },
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
  },
  {
    ...ints(
      "VexillaryPermutations",
      1,
      ([n]) => vexillaryClass.count(n),
      ([n], r) => vexillaryClass.unrank(n, r),
      (a, [n]) => vexillaryClass.valid(a, n),
      (a) => vexillaryClass.rank(a),
    ),
    declared: vexillaryClass.declared,
  },
];
