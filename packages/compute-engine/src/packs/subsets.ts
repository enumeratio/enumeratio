// Subsets — size-bounded, parity-bounded, and gap-avoiding subset families. Pure-TS rank/unrank
// kernels: no I/O beyond PackEntry/_shared, plain JS numbers/arrays. Consolidated from two
// parallel-authored packs; every kernel's rank(unrank(p,r),p)===r certification lives in
// test/selfcert.test.ts.

import type { PackEntry } from "./types.js";
import { binomial } from "./_shared.js";

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── SubsetsWithoutConsecutive(n): subsets of {1,...,n} containing no two consecutive integers.
// Counting the largest element n: either n is excluded (remaining is any valid subset of
// {1,...,n-1}: a(n-1) ways) or n is included (then n-1 is forced excluded, and the rest is any
// valid subset of {1,...,n-2}: a(n-2) ways). That gives a(0)=1 (only []), a(1)=2 ([], [1]), and
// a(m) = a(m-1) + a(m-2) for m>=2 — the Fibonacci recurrence, a(n) = F(n+2) in the F(1)=F(2)=1
// convention (n=0..5 -> 1,2,3,5,8,13). unrank puts the "exclude n" block first (size a(n-1)),
// then "include n" (size a(n-2)); rank replays the same split by checking whether the largest
// remaining element equals the current n. ──────────────────────────────────────────────────────

function subsetsNoConsecTable(n: number): number[] {
  const a = new Array(Math.max(n, 0) + 1).fill(0);
  a[0] = 1;
  if (n >= 1) a[1] = 2;
  for (let m = 2; m <= n; m++) a[m] = a[m - 1] + a[m - 2];
  return a;
}

function subsetsNoConsecCount(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return subsetsNoConsecTable(n)[n];
}

function unrankSubsetsNoConsec(n: number, r: number, a: number[]): number[] {
  if (n === 0) return [];
  if (n === 1) return r === 0 ? [] : [1];
  const excludeBlock = a[n - 1];
  if (r < excludeBlock) return unrankSubsetsNoConsec(n - 1, r, a);
  const rest = unrankSubsetsNoConsec(n - 2, r - excludeBlock, a);
  return [...rest, n]; // n > every element of rest, so ascending order is preserved
}

function rankSubsetsNoConsec(e: number[], n: number, a: number[]): number {
  if (n === 0) return 0; // e must be []
  if (n === 1) return e.length === 0 ? 0 : 1;
  if (e.length === 0 || e[e.length - 1] !== n) {
    // n excluded: e is (unchanged) a valid subset of {1,...,n-1}
    return rankSubsetsNoConsec(e, n - 1, a);
  }
  // n included: strip it, recurse into {1,...,n-2}, offset past the "exclude n" block
  const rest = e.slice(0, -1);
  return a[n - 1] + rankSubsetsNoConsec(rest, n - 2, a);
}

function subsetsWithoutConsecutiveUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const a = subsetsNoConsecTable(n);
  const total = a[n] ?? 0;
  return unrankSubsetsNoConsec(n, normRank(r, total), a);
}

function subsetsWithoutConsecutiveRank(e: any, p: number[]): number {
  const n = p[0];
  const a = subsetsNoConsecTable(n);
  return rankSubsetsNoConsec(e as number[], n, a);
}

function subsetsWithoutConsecutiveValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  for (let i = 0; i < e.length; i++) {
    const x = e[i];
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n) return false;
    if (i > 0 && x <= e[i - 1] + 1) return false; // strictly ascending AND gap >= 2 (no two consecutive)
  }
  return true;
}

// ─── SubsetsOfSizeAtMost(n,k): subsets of {1,...,n} with size <= k. Elements are ordered by size
// (all 0-subsets, then all 1-subsets, ..., then all k-subsets); within a size block the k-subsets
// are ordered by the standard combinatorial number system (colex order): a k-subset, read as
// 0-indexed values c_1 < c_2 < ... < c_k, gets rank sum_{i=1}^k C(c_i, i). Unranking is the
// classic greedy inverse: for i = k downto 1, pick the largest c_i with C(c_i, i) <= remaining.
// count(n,k) = sum_{i=0}^{k} C(n,i) (binomial(n,i) is 0 once i>n, so no separate n<k case). ────────

/** Greedy combinatorial-number-system unrank: the 0-indexed k-subset of {0,...,n-1} at colex rank r. */
function kSubsetUnrank(n: number, k: number, r: number): number[] {
  if (k === 0) return [];
  const c: number[] = new Array(k);
  let rem = r;
  for (let i = k; i >= 1; i--) {
    let ci = i - 1;
    while (ci + 1 <= n - 1 && binomial(ci + 1, i) <= rem) ci++;
    c[i - 1] = ci; // c[0] = c_1 < c[1] = c_2 < ... < c[k-1] = c_k (ascending, by construction)
    rem -= binomial(ci, i);
  }
  return c;
}

/** Exact inverse of kSubsetUnrank: colex rank of an ascending 0-indexed k-subset. */
function kSubsetRank(e0: number[]): number {
  let r = 0;
  for (let i = 1; i <= e0.length; i++) r += binomial(e0[i - 1], i);
  return r;
}

function subsetsAtMostKCount(p: number[]): number {
  const n = p[0];
  const k = p[1];
  if (n < 0 || k < 0) return 0;
  let total = 0;
  for (let i = 0; i <= k; i++) total += binomial(n, i);
  return total;
}

function subsetsAtMostKUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const k = p[1];
  const total = subsetsAtMostKCount(p);
  let rr = normRank(r, total);
  for (let size = 0; size <= k; size++) {
    const block = binomial(n, size);
    if (rr < block) return kSubsetUnrank(n, size, rr).map((x) => x + 1);
    rr -= block;
  }
  throw new Error(`SubsetsOfSizeAtMost: rank out of range for n=${n}, k=${k}`);
}

function subsetsAtMostKRank(e: any, p: number[]): number {
  const n = p[0];
  const es = e as number[];
  let offset = 0;
  for (let i = 0; i < es.length; i++) offset += binomial(n, i);
  return offset + kSubsetRank(es.map((x) => x - 1));
}

function subsetsAtMostKValid(e: any, p: number[]): boolean {
  const n = p[0];
  const k = p[1];
  if (!Array.isArray(e)) return false;
  if (e.length > k) return false;
  for (let i = 0; i < e.length; i++) {
    const x = e[i];
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n) return false;
    if (i > 0 && x <= e[i - 1]) return false; // strictly ascending, distinct
  }
  return true;
}

// ─── EvenSubsets(n) / OddSubsets(n): subsets of {1,...,n} with even (resp. odd) size. Bijection to
// ALL 2^(n-1) subsets S of {1,...,n-1}: keep S if its size already has the wanted parity, otherwise
// flip the parity by adjoining n (always the new max, so the result stays ascending). Every subset
// of {1,...,n-1} is used exactly once and every even/odd subset of {1,...,n} arises from exactly
// one S, so rank r (0 <= r < 2^(n-1)) IS the membership-mask of S over {1,...,n-1} (bit i-1 <=>
// element i in S). n=0 is the degenerate case: EvenSubsets(0) = {[]} (count 1), OddSubsets(0) = {}
// (count 0) — {1,...,-1} is empty, so there is no S to bijection against. ─────────────────────────

function maskToSubset(mask: number, maxElem: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < maxElem; i++) if (mask & (1 << i)) out.push(i + 1);
  return out;
}

function subsetToMask(s: number[]): number {
  let mask = 0;
  for (const x of s) mask |= 1 << (x - 1);
  return mask;
}

function evenOddCount(n: number, wantOdd: boolean): number {
  if (n < 0) return 0;
  if (n === 0) return wantOdd ? 0 : 1;
  return 2 ** (n - 1);
}

function evenOddUnrank(p: number[], r: number, wantOdd: boolean): number[] {
  const n = p[0];
  if (n <= 0) return []; // EvenSubsets(0): only r=0, the empty set; OddSubsets(0) has no valid r
  const total = evenOddCount(n, wantOdd);
  const mask = normRank(r, total);
  const s = maskToSubset(mask, n - 1);
  const parityMatches = s.length % 2 === (wantOdd ? 1 : 0);
  return parityMatches ? s : [...s, n]; // n is always > every element of s, so this stays ascending
}

function evenOddRank(e: any, p: number[]): number {
  const n = p[0];
  if (n <= 0) return 0;
  const es = e as number[];
  const s = es.length > 0 && es[es.length - 1] === n ? es.slice(0, -1) : es;
  return subsetToMask(s);
}

function evenOddValid(e: any, p: number[], wantOdd: boolean): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  for (let i = 0; i < e.length; i++) {
    const x = e[i];
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n) return false;
    if (i > 0 && x <= e[i - 1]) return false;
  }
  return e.length % 2 === (wantOdd ? 1 : 0);
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "SubsetsWithoutConsecutive",
    paramCount: 1,
    kind: "ints",
    count: subsetsNoConsecCount,
    unrank: subsetsWithoutConsecutiveUnrank,
    rank: subsetsWithoutConsecutiveRank,
    valid: subsetsWithoutConsecutiveValid,
  },
  {
    head: "SubsetsOfSizeAtMost",
    paramCount: 2,
    kind: "ints",
    count: subsetsAtMostKCount,
    unrank: subsetsAtMostKUnrank,
    rank: subsetsAtMostKRank,
    valid: subsetsAtMostKValid,
  },
  {
    head: "EvenSubsets",
    paramCount: 1,
    kind: "ints",
    count: (p) => evenOddCount(p[0], false),
    unrank: (p, r) => evenOddUnrank(p, r, false),
    rank: evenOddRank,
    valid: (e, p) => evenOddValid(e, p, false),
  },
  {
    head: "OddSubsets",
    paramCount: 1,
    kind: "ints",
    count: (p) => evenOddCount(p[0], true),
    unrank: (p, r) => evenOddUnrank(p, r, true),
    rank: evenOddRank,
    valid: (e, p) => evenOddValid(e, p, true),
  },
];
