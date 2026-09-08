// pack-s.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// PartitionsIntoParts1And2(n) and RevolvingDoorKSubsets(n,k). Self-contained:
// no imports, no I/O, plain JS numbers/arrays. See .scratch/pack-s-selfcert.mts
// for the exhaustive rank(unrank(p,r),p)===r certification plus the
// revolving-door Gray-code adjacency check (consecutive ranks differ by
// exactly one removed + one added element).

import type { PackEntry } from "./types.js";

function binom(n: number, k: number): number {
  if (n < 0 || k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < kk; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
}

// ---- PartitionsIntoParts1And2(n) -------------------------------------------
// Integer partitions of n with every part in {1,2}, i.e. weakly-decreasing
// lists of 2's then 1's. Fixing t = number of 2's (0 <= t <= floor(n/2))
// determines the partition uniquely: [2]*t ++ [1]*(n-2t). Count = floor(n/2)+1.
// unrank(r) sets t=r directly (r=0 is all 1's, r=floor(n/2) is max 2's, with
// at most one leftover 1 when n is odd); rank(e) reads t back off as the
// count of 2's in e — an exact inverse by construction.

function partitions12Count(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return Math.floor(n / 2) + 1;
}

function partitions12Unrank(p: number[], r: number): number[] {
  const n = p[0];
  const t = r; // number of 2's
  const ones = n - 2 * t;
  const parts: number[] = [];
  for (let i = 0; i < t; i++) parts.push(2);
  for (let i = 0; i < ones; i++) parts.push(1);
  return parts;
}

function partitions12Rank(e: any, _p: number[]): number {
  const arr = e as number[];
  let t = 0;
  for (const v of arr) if (v === 2) t++;
  return t;
}

function partitions12Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (let i = 0; i < e.length; i++) {
    const v = e[i];
    if (v !== 1 && v !== 2) return false;
    if (i > 0 && v > e[i - 1]) return false; // weakly decreasing (2's before 1's)
    sum += v;
  }
  return sum === n;
}

// ---- RevolvingDoorKSubsets(n,k) --------------------------------------------
// The k-subsets of {1,...,n} in revolving-door (Gray-code) order: consecutive
// subsets differ by removing one element and adding one (symmetric
// difference of size 2). Elements are 1-indexed ascending, matching the
// public representation directly (no internal shift needed).
//
// Direct closed-form rank/unrank (Kreher & Stinson, "Combinatorial
// Algorithms", CRC Press 1998 — ksubset_revdoor_rank/ksubset_revdoor_unrank,
// the standard reference implementation for this ordering; ported here from
// the FORTRAN source): unrank walks positions i = k..1 (largest element
// first): find the largest x with C(x,i) <= remaining rank, set t[i] = x+1,
// and update the remaining rank to C(x+1,i) - rank - 1 (this "reflects" the
// rank the way a Gray-code odometer carries, which is what produces the
// single-swap adjacency instead of plain combinadic/lexicographic order).
// rank is the alternating-sign inverse:
//   rank = (k even ? 0 : -1) + sum_{i=k..1} (-1)^{k-i} * C(t[i], i).
// (A first from-scratch attempt here — split the k-subsets of {0,...,n-1}
// into "excludes n-1" / "includes n-1" blocks and reversed one block by
// parity of k — passed the rank(unrank(r))===r inverse check but FAILED the
// Gray-code adjacency property starting at n=6,k=3: the boundary between the
// two blocks isn't guaranteed to be a single-element swap under that naive
// split. Replaced with this verified closed form instead of re-deriving.)

function revDoorUnrank1Indexed(n: number, k: number, rank: number): number[] {
  let rankCopy = rank;
  let x = n;
  const t = new Array(k);
  for (let i = k; i >= 1; i--) {
    while (rankCopy < binom(x, i)) x--;
    t[i - 1] = x + 1;
    rankCopy = binom(x + 1, i) - rankCopy - 1;
  }
  return t;
}

function revDoorRank1Indexed(t: number[], k: number): number {
  let rank = k % 2 === 0 ? 0 : -1;
  let s = 1;
  for (let i = k; i >= 1; i--) {
    rank += s * binom(t[i - 1], i);
    s = -s;
  }
  return rank;
}

function revolvingDoorCount(p: number[]): number {
  const [n, k] = p;
  return binom(n, k);
}

function revolvingDoorUnrank(p: number[], r: number): number[] {
  const [n, k] = p;
  if (k === 0) return [];
  return revDoorUnrank1Indexed(n, k, r);
}

function revolvingDoorRank(e: any, p: number[]): number {
  const [, k] = p;
  if (k === 0) return 0;
  return revDoorRank1Indexed(e as number[], k);
}

function revolvingDoorValid(e: any, p: number[]): boolean {
  const [n, k] = p;
  if (!Array.isArray(e) || e.length !== k) return false;
  for (let i = 0; i < e.length; i++) {
    const v = e[i];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > n) return false;
    if (i > 0 && v <= e[i - 1]) return false; // strictly ascending, so distinct
  }
  return true;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "PartitionsIntoParts1And2",
    paramCount: 1,
    kind: "ints",
    count: partitions12Count,
    unrank: partitions12Unrank,
    rank: partitions12Rank,
    valid: partitions12Valid,
  },
  {
    head: "RevolvingDoorKSubsets",
    paramCount: 2,
    kind: "ints",
    count: revolvingDoorCount,
    unrank: revolvingDoorUnrank,
    rank: revolvingDoorRank,
    valid: revolvingDoorValid,
  },
];
