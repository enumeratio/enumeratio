// pack-r.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// SubsetsWithoutConsecutive(n) and CompositionsIntoPartsAtLeast2(n). Self-contained:
// no imports, no I/O, plain JS numbers/arrays. See .scratch/pack-r-selfcert.mts for
// the exhaustive rank(unrank(p,r),p)===r certification plus an independent
// brute-force (generate-all-and-filter) cross-check of count()/valid(), and a
// direct check against the Fibonacci reference values named in the task.

import type { PackEntry } from "./types.js";

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── SubsetsWithoutConsecutive(n): subsets of {1,...,n} containing no two consecutive integers.
// Counting the largest element n: either n is excluded (remaining is any valid subset of
// {1,...,n-1}: a(n-1) ways) or n is included (then n-1 is forced excluded, and the rest is any
// valid subset of {1,...,n-2}: a(n-2) ways). That gives a(0)=1 (only []), a(1)=2 ([], [1]), and
// a(m) = a(m-1) + a(m-2) for m>=2 — the Fibonacci recurrence, a(n) = F(n+2) in the F(1)=F(2)=1
// convention (n=0..5 -> 1,2,3,5,8,13, matching the task's reference values). unrank puts the
// "exclude n" block first (size a(n-1)), then "include n" (size a(n-2)); rank replays the same
// split by checking whether the largest remaining element equals the current n. ─────────────────

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

// ─── CompositionsIntoPartsAtLeast2(n): compositions of n (order matters) with every part >= 2.
// Recurrence on the first part v (2 <= v <= n): the remaining n-v is any such composition of
// n-v, giving c(0)=1 (empty composition) and c(m) = sum_{v=2}^{m} c(m-v) for m>=1 (c(1)=0, the
// empty sum). This is Fibonacci F(n-1) in the F(1)=F(2)=1 convention (n=0,2,3,4,5,6,7 ->
// 1,1,1,2,3,5,8, matching the task's reference values). unrank walks v=2,3,... consuming
// c(rem-v)-sized blocks and recursing into the remainder; rank replays the same walk. ────────────

function compAtLeast2Table(n: number): number[] {
  const c = new Array(Math.max(n, 0) + 1).fill(0);
  c[0] = 1;
  for (let m = 1; m <= n; m++) {
    let total = 0;
    for (let v = 2; v <= m; v++) total += c[m - v];
    c[m] = total;
  }
  return c;
}

function compAtLeast2Count(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return compAtLeast2Table(n)[n];
}

function unrankCompAtLeast2(n: number, r: number, c: number[]): number[] {
  if (n === 0) return [];
  let rr = r;
  for (let v = 2; v <= n; v++) {
    const block = c[n - v];
    if (rr < block) return [v, ...unrankCompAtLeast2(n - v, rr, c)];
    rr -= block;
  }
  throw new Error(`CompositionsIntoPartsAtLeast2: rank out of range for n=${n}`);
}

function rankCompAtLeast2(e: number[], n: number, c: number[]): number {
  if (n === 0) return 0; // e must be []
  const v = e[0];
  let offset = 0;
  for (let vv = 2; vv < v; vv++) offset += c[n - vv];
  return offset + rankCompAtLeast2(e.slice(1), n - v, c);
}

function compositionsIntoPartsAtLeast2Unrank(p: number[], r: number): number[] {
  const n = p[0];
  const c = compAtLeast2Table(n);
  const total = c[n] ?? 0;
  return unrankCompAtLeast2(n, normRank(r, total), c);
}

function compositionsIntoPartsAtLeast2Rank(e: any, p: number[]): number {
  const n = p[0];
  const c = compAtLeast2Table(n);
  return rankCompAtLeast2(e as number[], n, c);
}

function compositionsIntoPartsAtLeast2Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const x of e) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < 2) return false;
    sum += x;
  }
  return sum === n;
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
    head: "CompositionsIntoPartsAtLeast2",
    paramCount: 1,
    kind: "ints",
    count: compAtLeast2Count,
    unrank: compositionsIntoPartsAtLeast2Unrank,
    rank: compositionsIntoPartsAtLeast2Rank,
    valid: compositionsIntoPartsAtLeast2Valid,
  },
];
