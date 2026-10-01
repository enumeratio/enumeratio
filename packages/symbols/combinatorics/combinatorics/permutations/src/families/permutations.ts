// Permutation-carrier families that were catalogued (packages/reference/entries/) but never
// wired to a kernel. Kept in its own file (rather than folded into core.ts) so parallel batches of this
// same roadmap item don't collide on one file. Reuses ./kernels.ts (Factorial/PermutationUnrank/
// PermutationRank/IsPermutationOf/LehmerCode/Inversions) and ./kernels-extra.ts (KPermutation*) wherever
// the element representation already matches; only genuinely new combinatorics get new code here.
import { binomial, catalanNumber } from "../../../collections/src/families/shared.ts";
import {
  Factorial,
  Inversions,
  IsPermutationOf,
  LehmerCode,
  PermutationRank,
  PermutationUnrank,
} from "../../../collections/src/families/kernels.ts";
import {
  IsKPermutationOf,
  KPermutationCount,
  KPermutationRank,
  KPermutationUnrank,
} from "../../../collections/src/families/kernels-extra.ts";
import { IntegerPartitionRank } from "../../../collections/src/families/kernels-combinatorics.ts";
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import { inducedOrder } from "../../../collections/src/families/induced-order.ts";
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import { kCyclePermutations } from "./core.ts";

// helper to cut boilerplate for the flat (number[]) shape; mirrors core.ts's private `ints`.
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

// ─── EvenPermutations(n): the alternating group Aₙ, one-line words. ────────────────────────────────
// Lex-rank pairs (2m, 2m+1) always differ by swapping the trailing two entries (the factorial-base
// digit at that place has weight 1 and only two values), so they have opposite parity — exactly one of
// each pair is even. That makes "the r-th even permutation" just "whichever half of pair r is even".
function evenPermutationCount(n: number): number {
  return n <= 1 ? 1 : Factorial(n) / 2;
}
function evenPermutationUnrank(n: number, r: number): number[] {
  if (n <= 1) return PermutationUnrank(n, 0);
  const total = evenPermutationCount(n);
  const rr = total > 0 ? ((Math.trunc(r) % total) + total) % total : 0;
  const base = PermutationUnrank(n, 2 * rr);
  return Inversions(base) % 2 === 0 ? base : PermutationUnrank(n, 2 * rr + 1);
}
function isEvenPermutation(perm: number[], n: number): boolean {
  return IsPermutationOf(perm, n) && Inversions(perm) % 2 === 0;
}

// ─── LehmerCodes(n): the inversion tables, in their own order: read as factoradic numbers, which
// is what makes the order implied rather than chosen. They match Permutations' lex order only
// because that is the order we chose for Permutations. Element = LehmerCode(perm) ──
// (length n−1, trailing implied 0 dropped, same convention ./kernels.ts already uses).
function permutationFromLehmerCode(code: number[], n: number): number[] {
  const L = [...code, 0];
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  const res: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = L[i];
    res.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return res;
}
function isValidLehmerCode(code: number[], n: number): boolean {
  if (!Array.isArray(code) || code.length !== Math.max(n - 1, 0)) return false;
  for (let i = 0; i < code.length; i++) {
    const v = code[i];
    if (!Number.isInteger(v) || v < 0 || v > n - 1 - i) return false;
  }
  return true;
}

// ─── SubexcedantSeqs(n): words (a₀,…,aₙ₋₁) with 0 ≤ aᵢ ≤ i (0-indexed) — its own factorial-base ────
// odometer, a sibling of lehmer_codes with a different bound (aᵢ ≤ i here, vs the Lehmer code's aᵢ ≤ n−1−i).
function subexcedantBlockSize(n: number, i: number): number {
  return Factorial(n) / Factorial(i + 1); // completions after position i
}
function subexcedantUnrank(n: number, r: number): number[] {
  const total = Factorial(n);
  let x = total > 0 ? ((Math.trunc(r) % total) + total) % total : 0;
  const terms: number[] = [];
  for (let i = 0; i < n; i++) {
    const bs = subexcedantBlockSize(n, i);
    const d = Math.floor(x / bs);
    terms.push(d);
    x -= d * bs;
  }
  return terms;
}
function subexcedantRank(terms: number[], n: number): number {
  let r = 0;
  for (let i = 0; i < n; i++) r += terms[i] * subexcedantBlockSize(n, i);
  return r;
}
function isSubexcedant(terms: number[], n: number): boolean {
  if (!Array.isArray(terms) || terms.length !== n) return false;
  for (let i = 0; i < n; i++) {
    const v = terms[i];
    if (!Number.isInteger(v) || v < 0 || v > i) return false;
  }
  return true;
}

// ─── AlternatingPermutations(n): a₁<a₂>a₃<… (Euler zigzag / Entringer numbers, A000111). ──────────
// The max value n can only sit at a position i whose required relation to i+1 is "descend" (n can't be
// less than what follows) — that's exactly the ODD 0-indexed positions (an "i = n−1, no next" slot turns
// out to coincide with this: the last position only admits n when n−1 itself is odd). Split the other
// n−1 values into a left block of size i and a right block of size n−1−i, freely (any subset — the
// pattern only constrains ADJACENT pairs, so left/right values don't need to interleave by magnitude,
// unlike the 231 decomposition); each block is independently alternating on its relative values.
const alternatingCache = new Map<number, number>();
function alternatingCount(n: number): number {
  if (n <= 1) return 1;
  const cached = alternatingCache.get(n);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let i = 1; i < n; i += 2) total += binomial(n - 1, i) * alternatingCount(i) * alternatingCount(n - 1 - i);
  alternatingCache.set(n, total);
  return total;
}
function isAlternating(perm: readonly number[], n: number): boolean {
  if (!IsPermutationOf(perm as number[], n)) return false;
  for (let i = 0; i + 1 < n; i++) {
    const needAscent = i % 2 === 0;
    if (needAscent ? !(perm[i] < perm[i + 1]) : !(perm[i] > perm[i + 1])) return false;
  }
  return true;
}

// ─── ConnectedPermutations(n): indecomposable — no proper prefix's values are exactly {1,…,j} (A003319) ─
// Insert values 1,2,…,n in increasing order (each newly-inserted value is the current max, so it either
// starts a new "record" or fills a gap below the current running max). Track only e = runningMax −
// position — how far the max is ahead of where it "should" be for a decomposition to occur right there
// (e=0 mid-sequence IS a decomposition point, so every intermediate step must keep e ≥ 1). At each step,
// from (remaining count m, excess e): either extend the run by choosing how far above the old max to
// jump (m−e ways, each landing on a distinct new e′ ≥ e — always safe), or drop into one of the e
// still-open "gap" values below the running max (e ways, e′ = e−1 — safe only if e ≥ 2, or if this is
// the very last placement). f(m, e) counts completions from that state; f(n, 0) is the top-level count
// (its own m>1,e=0,t=1 branch — "place the new value BELOW itself", impossible — is excluded, which is
// exactly what rules out an immediate decomposition at the very first position).
const connectedF = new Map<string, number>();
function connectedFCompletions(m: number, e: number): number {
  if (m === 0) return 1;
  const key = `${m},${e}`;
  const cached = connectedF.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  const maxT = m - e;
  for (let t = 1; t <= maxT; t++) {
    if (e === 0 && m > 1 && t === 1) continue; // would decompose right here
    total += connectedFCompletions(m - 1, e + (t - 1));
  }
  if (e >= 2 || m === 1) total += e * connectedFCompletions(m - 1, e - 1);
  connectedF.set(key, total);
  return total;
}
function connectedCount(n: number): number {
  return connectedFCompletions(n, 0);
}
function isConnected(perm: readonly number[], n: number): boolean {
  if (!IsPermutationOf(perm as number[], n)) return false;
  let runningMax = 0;
  for (let j = 1; j < n; j++) {
    runningMax = Math.max(runningMax, perm[j - 1]);
    if (runningMax === j) return false;
  }
  return true;
}

// ─── PermutationsAvoiding{123,132,213,231,312,321}(n): classical length-3 pattern classes, all ────────
// Catalan-counted (Knuth). `containsPattern` (an O(n³) triple check, parameterized by the pattern) is
// what `valid()` uses for every one of the six — cheap at any n, and the only check needed for
// membership. Rank/unrank need to be efficient though (these get `at()`-ed from docs), so instead of
// searching we reuse ONE genuinely recursive decomposition (231, split on the position of n: everything
// before it must be the block {1,…,m}, everything after {m+1,…,n−1}, each in turn 231-avoiding — the
// standard Catalan convolution) and reach the other three "quadrant" patterns via the classical
// reverse/complement/inverse symmetries of pattern classes (reverse∘231=132, complement∘231=213,
// inverse∘231=312). 123 and 321 don't decompose that way (n can't play a role in the *ascending*
// pattern's extremal position without extra bookkeeping); 321 instead uses the standard "insert values
// 1..n in increasing order, tracking only the length of the current increasing suffix" DP — a genuine
// insertion bijection, not a search — and 123 is its complement (complement∘321=123).
const PATTERNS: Record<string, readonly [number, number, number]> = {
  PermutationsAvoiding123: [1, 2, 3],
  PermutationsAvoiding132: [1, 3, 2],
  PermutationsAvoiding213: [2, 1, 3],
  PermutationsAvoiding231: [2, 3, 1],
  PermutationsAvoiding312: [3, 1, 2],
  PermutationsAvoiding321: [3, 2, 1],
};

function patternOf(a: number, b: number, c: number): readonly [number, number, number] {
  const sorted = [a, b, c];
  sorted.sort((x, y) => x - y);
  return [sorted.indexOf(a) + 1, sorted.indexOf(b) + 1, sorted.indexOf(c) + 1];
}
function containsPattern(perm: readonly number[], pattern: readonly [number, number, number]): boolean {
  const n = perm.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const p = patternOf(perm[i], perm[j], perm[k]);
        if (p[0] === pattern[0] && p[1] === pattern[1] && p[2] === pattern[2]) return true;
      }
  return false;
}

// Av(231): position m of n splits into a {1,…,m} block (231-avoiding) then n then a {m+1,…,n−1} block
// (231-avoiding) — any before/after pair with before > after would itself be a 231 with n as the "3", so
// avoidance forces the blocks apart like this. Count is the Catalan convolution by construction.

// Av(321): insert values 1,2,…,n in increasing order. Each new value is the current max, so it can only
// violate 321 by sitting before a still-later descent; valid gaps are exactly "within the current
// trailing increasing run", (s+1) of them where s is that run's length — and the run's length after
// inserting is all the DP needs to remember (not the whole arrangement). f(remaining, s) = completions
// from state s with `remaining` insertions left to place.

// The remaining four are these two under the classical symmetries of pattern classes: reverse maps
// Av(231)→Av(132), complement maps Av(231)→Av(213) and Av(321)→Av(123), inverse maps Av(231)→Av(312).

// ─── KCyclePermutations(n,k): exactly k cycles — the unsigned Stirling-1 triangle. ─────────────────
// Built by the standard insertion bijection: c(n,k) = c(n−1,k−1) + (n−1)·c(n−1,k) — element n either
// starts a new (singleton) cycle, or is spliced in right after one of the n−1 existing elements, in
// "successor function" terms (which is exactly one-line notation: image[i] = successor of i).

// ─── KDescentPermutations(n,k): exactly k descents — the Eulerian triangle. ────────────────────────
// Insertion bijection: A(n,k) = (k+1)·A(n−1,k) + (n−k)·A(n−1,k−1). Inserting the max value n into a
// permutation of [n−1]: the (k+1) gaps that leave the descent count at k are "after the last element"
// plus "right at each of its k existing descents"; the (n−k) gaps that raise it from k−1 to k are
// "before the first element" plus "right at each of its ascents".
const eulerianCache = new Map<string, number>();
function eulerianA(n: number, k: number): number {
  if (n === 0) return k === 0 ? 1 : 0;
  if (k < 0 || k > n - 1) return 0;
  const key = `${n},${k}`;
  const cached = eulerianCache.get(key);
  if (cached !== undefined) return cached;
  const v = (k + 1) * eulerianA(n - 1, k) + (n - k) * eulerianA(n - 1, k - 1);
  eulerianCache.set(key, v);
  return v;
}
function descentPositions(perm: readonly number[]): number[] {
  const res: number[] = [];
  for (let i = 0; i + 1 < perm.length; i++) if (perm[i] > perm[i + 1]) res.push(i);
  return res;
}

// ─── KInversionPermutations(n,k): exactly k inversions — the Mahonian triangle. ────────────────────
// k = the LehmerCode digit sum; digit i (0-indexed) ranges over [0, n−1−i], so counting/ranking is a
// bounded-digit-sum mixed-radix problem — coefficients of ∏ᵢ(1+q+…+qⁱ), i.e. the q-factorial [n]_q!.
const mahonianCache = new Map<number, number[][]>();
function mahonianTable(n: number): number[][] {
  let table = mahonianCache.get(n);
  if (table) return table;
  table = Array.from({ length: n + 1 });
  table[n] = [1];
  for (let pos = n - 1; pos >= 0; pos--) {
    const maxDigit = n - 1 - pos;
    const prev = table[pos + 1];
    const poly: number[] = Array.from({ length: prev.length - 1 + maxDigit + 1 }, () => 0);
    for (let d = 0; d <= maxDigit; d++) for (let s = 0; s < prev.length; s++) poly[d + s] += prev[s];
    table[pos] = poly;
  }
  mahonianCache.set(n, table);
  return table;
}
function mahonianCount(n: number, k: number): number {
  if (n === 0) return k === 0 ? 1 : 0;
  const poly = mahonianTable(n)[0];
  return k >= 0 && k < poly.length ? poly[k] : 0;
}
function kInversionUnrank(n: number, k: number, r: number): number[] {
  if (n === 0) return [];
  const table = mahonianTable(n);
  let remaining = k;
  let rr = r;
  const code: number[] = [];
  for (let pos = 0; pos < n - 1; pos++) {
    const maxDigit = n - 1 - pos;
    const restPoly = table[pos + 1];
    let d = 0;
    for (; d <= maxDigit; d++) {
      const need = remaining - d;
      const c = need >= 0 && need < restPoly.length ? restPoly[need] : 0;
      if (rr < c) break;
      rr -= c;
    }
    code.push(d);
    remaining -= d;
  }
  return permutationFromLehmerCode(code, n);
}
function kInversionRank(perm: number[], n: number): number {
  const code = LehmerCode(perm);
  const table = mahonianTable(n);
  let remaining = code.reduce((a, b) => a + b, 0);
  let rank = 0;
  for (let pos = 0; pos < code.length; pos++) {
    const d = code[pos];
    const restPoly = table[pos + 1];
    for (let dd = 0; dd < d; dd++) {
      const need = remaining - dd;
      rank += need >= 0 && need < restPoly.length ? restPoly[need] : 0;
    }
    remaining -= d;
  }
  return rank;
}

// ─── PermutationsAsCycles(n): every permutation of n in cycle notation, fixed points kept. ─────
// A cycle decomposition is canonical: each cycle starts at its least point, cycles in order of
// those points. Listed by cycle type in IntegerPartitions' order (the n-cycles first, the
// identity last), then by canonical form, lexicographically. The order is our choice.
export function CycleDecomposition(perm: readonly number[]): number[][] {
  const seen: boolean[] = Array.from({ length: perm.length + 1 }, () => false);
  const cycles: number[][] = [];
  for (let start = 1; start <= perm.length; start++) {
    if (seen[start]) continue;
    const cycle: number[] = [];
    for (let point = start; !seen[point]; point = perm[point - 1]!) {
      seen[point] = true;
      cycle.push(point);
    }
    cycles.push(cycle);
  }
  return cycles;
}
/** The permutation a cycle decomposition describes; undefined when it isn't a canonical one. */
export function PermutationOfCycleDecomposition(cycles: readonly (readonly number[])[]): number[] | undefined {
  const n = cycles.reduce((total, cycle) => total + cycle.length, 0);
  const perm: number[] = Array.from({ length: n }, () => 0);
  for (const cycle of cycles)
    for (let i = 0; i < cycle.length; i++) {
      const point = cycle[i]!;
      if (!Number.isInteger(point) || point < 1 || point > n || perm[point - 1] !== 0) return undefined;
      perm[point - 1] = cycle[(i + 1) % cycle.length]!;
    }
  const canonical = CycleDecomposition(perm);
  return JSON.stringify(canonical) === JSON.stringify(cycles) ? perm : undefined;
}
const cycleTypeOf = (cycles: readonly (readonly number[])[]): number[] =>
  cycles.map((cycle) => cycle.length).toSorted((a, b) => b - a);
const lexCompare = (a: readonly (readonly number[])[], b: readonly (readonly number[])[]): number => {
  const flat = (cycles: readonly (readonly number[])[]) => cycles.flatMap((cycle) => [...cycle, 0]);
  const x = flat(a);
  const y = flat(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
  return x.length - y.length;
};
const cycleListing = new Map<number, { list: number[][][]; rank: Map<string, number> }>();
function cyclesListed(n: number): { list: number[][][]; rank: Map<string, number> } {
  let listed = cycleListing.get(n);
  if (listed === undefined) {
    const list = Array.from({ length: Factorial(n) }, (_, r) => CycleDecomposition(PermutationUnrank(n, r)))
      .map((cycles) => ({ cycles, type: IntegerPartitionRank(cycleTypeOf(cycles), n) }))
      .toSorted((a, b) => a.type - b.type || lexCompare(a.cycles, b.cycles))
      .map(({ cycles }) => cycles);
    listed = { list, rank: new Map(list.map((cycles, r) => [JSON.stringify(cycles), r])) };
    cycleListing.set(n, listed);
  }
  return listed;
}
export const PermutationsAsCyclesFamily: NumberKernel = {
  declared: {
    carrier: "CycleDecomposition",
    params: [{ name: "n", role: "axis", min: 0 }],
    cost: { count: "closed", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
    work: ([n]) => BigInt(Factorial(n!)),
  },
  head: "PermutationsAsCycles",
  paramCount: 1,
  kind: "blocks",
  carrier: "CycleDecomposition",
  count: ([n]) => Factorial(n!),
  unrank: ([n], r) => cyclesListed(n!).list[Number(r)]!,
  valid: (e, [n]) => Array.isArray(e) && (PermutationOfCycleDecomposition(e as number[][])?.length ?? -1) === n,
  rank: (e, [n]) => cyclesListed(n!).rank.get(JSON.stringify(e)) ?? -1,
};

export const entries: (NumberKernel | EpsilFamily)[] = [
  {
    ...ints(
      "EvenPermutations",
      1,
      ([n]) => evenPermutationCount(n),
      ([n], r) => evenPermutationUnrank(n, r),
      (a, [n]) => isEvenPermutation(a, n),
      (a) => Math.floor(PermutationRank(a) / 2),
    ),
    carrier: "Permutation",
  },
  {
    ...ints(
      "Arrangements",
      2,
      ([n, k]) => KPermutationCount(n, k),
      ([n, k], r) => KPermutationUnrank(n, k, r),
      (a, [n, k]) => IsKPermutationOf(a, n, k),
      (a, [n]) => KPermutationRank(a, n),
    ),
    carrier: "Arrangement",
  },
  PermutationsAsCyclesFamily,
  {
    ...ints(
      "LehmerCodes",
      1,
      ([n]) => Factorial(n),
      ([n], r) => LehmerCode(PermutationUnrank(n, r)),
      (a, [n]) => isValidLehmerCode(a, n),
      (a, [n]) => PermutationRank(permutationFromLehmerCode(a, n)),
    ),
    carrier: "PermutationInversion",
  },
  {
    ...ints(
      "SubexcedantSeqs",
      1,
      ([n]) => Factorial(n),
      ([n], r) => subexcedantUnrank(n, r),
      (a, [n]) => isSubexcedant(a, n),
      (a, [n]) => subexcedantRank(a, n),
    ),
    carrier: "SubexcedantSeq",
  },
  inducedOrder({
    head: "AlternatingPermutations",
    paramCount: 1,
    count: ([n]) => alternatingCount(n),
    member: (a, [n]) => isAlternating(a as number[], n),
  }),
  inducedOrder({
    head: "ConnectedPermutations",
    paramCount: 1,
    count: ([n]) => connectedCount(n),
    member: (a, [n]) => isConnected(a as number[], n),
  }),
  kCyclePermutations,
  inducedOrder({
    head: "KDescentPermutations",
    paramCount: 2,
    count: ([n, k]) => eulerianA(n, k),
    member: (a, [, k]) => descentPositions(a as number[]).length === k,
  }),
  {
    ...ints(
      "KInversionPermutations",
      2,
      ([n, k]) => mahonianCount(n, k),
      ([n, k], r) => kInversionUnrank(n, k, r),
      (a, [n, k]) => IsPermutationOf(a, n) && Inversions(a) === k,
      (a, [n]) => kInversionRank(a, n),
    ),
    carrier: "Permutation",
  },
  ...Object.entries(PATTERNS).map(([head, pattern]) =>
    inducedOrder({
      head,
      paramCount: 1,
      count: ([n]) => catalanNumber(n),
      member: (a) => !containsPattern(a as number[], pattern),
    }),
  ),
];
