// pack-u.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// RestrictedGrowthStrings(n) and BinaryStringsAvoiding00(n). Self-contained: no
// imports, no I/O, plain JS numbers/arrays. See .scratch/pack-u-selfcert.mts for
// the exhaustive rank(unrank(p,r),p)===r certification plus an independent
// brute-force (generate-all-length-n-sequences-and-filter) cross-check of
// count()/valid(), and a check against the given Bell/Fibonacci reference values.

import type { PackEntry } from "./types.js";

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── RestrictedGrowthStrings(n): length-n integer strings w with w[0]=0 and w[i] <= 1+max(w[0..i-1])
// for i>=1 — the canonical "restricted growth string" carrier for set partitions of an n-set (w[i] is
// the block index of element i, in first-appearance order), counted by Bell(n) (1,1,2,5,15,52,203,...).
// f(k,m) = number of valid length-k SUFFIXES given the running max is m going in: f(0,m)=1 (nothing left
// to place), f(k,m) = (m+1)*f(k-1,m) + f(k-1,m+1) — the next symbol is either a reuse v in {0..m} (m+1
// choices, max stays m) or the single "extend" choice v=m+1 (max becomes m+1). count(n) = f(n-1,0), the
// completions of positions 1..n-1 after the fixed w[0]=0. unrank walks that same split — v=0..m in
// order (each a same-size f(k,m) block), then the extend choice (an f(k,m+1) block) — to locate r;
// rank replays the identical split to relocate a given w. ─────────────────────────────────────────────

function rgsTable(n: number): number[][] {
  // f[k][m], k=0..n, m=0..n+1 (m never needs to exceed n in a length-n string, +1 kept for headroom).
  const f: number[][] = [];
  for (let k = 0; k <= n; k++) f.push(new Array(n + 2).fill(0));
  for (let m = 0; m <= n + 1; m++) f[0][m] = 1; // no positions left: always exactly one (empty) completion
  for (let k = 1; k <= n; k++) {
    for (let m = 0; m <= n; m++) {
      f[k][m] = (m + 1) * f[k - 1][m] + f[k - 1][m + 1];
    }
  }
  return f;
}

function restrictedGrowthStringsCount(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  if (n === 0) return 1;
  return rgsTable(n)[n - 1][0];
}

function restrictedGrowthStringsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  if (n <= 0) return [];
  const f = rgsTable(n);
  const total = f[n - 1][0];
  let rem = normRank(r, total);
  const w = [0];
  let m = 0;
  for (let i = 1; i < n; i++) {
    const k = n - 1 - i; // positions remaining after this one
    let chosen = -1;
    for (let v = 0; v <= m; v++) {
      const block = f[k][m];
      if (rem < block) { chosen = v; break; }
      rem -= block;
    }
    if (chosen === -1) {
      chosen = m + 1; // the single "extend the max" choice
      m = m + 1;
    }
    w.push(chosen);
  }
  return w;
}

function restrictedGrowthStringsRank(e: any, p: number[]): number {
  const n = p[0];
  if (n <= 0) return 0;
  const f = rgsTable(n);
  const w = e as number[];
  let rank = 0;
  let m = 0;
  for (let i = 1; i < n; i++) {
    const k = n - 1 - i;
    const v = w[i];
    if (v <= m) {
      rank += v * f[k][m];
    } else {
      rank += (m + 1) * f[k][m];
      m = v; // v === m+1 for a valid string
    }
  }
  return rank;
}

function restrictedGrowthStringsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  if (n === 0) return true;
  if (e[0] !== 0) return false;
  let mx = 0;
  for (let i = 1; i < n; i++) {
    const v = e[i];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > mx + 1) return false;
    if (v > mx) mx = v;
  }
  return true;
}

// ─── BinaryStringsAvoiding00(n): length-n strings over {0,1} with no two consecutive 0s, counted by
// Fibonacci F(n+2) (1,2,3,5,8,13,...; F(1)=F(2)=1). DP on the trailing-bit state: hFalse[k] = valid
// completions of a length-k suffix when the previous bit was NOT 0 (or there is no previous bit — the
// state the string starts in); hTrue[k] = completions when the previous bit WAS 0 (so the next bit is
// forced to 1). hFalse[0]=hTrue[0]=1 (nothing left); hTrue[k]=hFalse[k-1] (forced 1, then free);
// hFalse[k]=hTrue[k-1]+hFalse[k-1] (place 0 then forced-state, or place 1 then free-state) — which is
// exactly the Fibonacci recurrence on hFalse. count(n)=hFalse[n]. unrank walks bit-by-bit: from the
// free state, the "place 0" branch is an hTrue[k]-sized block tried first, else "place 1"; from the
// forced state there is only one legal bit (1), no rank consumed. rank replays the identical walk. ────

function noZeroZeroTable(n: number): { hFalse: number[]; hTrue: number[] } {
  const hFalse = new Array(n + 1).fill(0);
  const hTrue = new Array(n + 1).fill(0);
  hFalse[0] = 1;
  hTrue[0] = 1;
  for (let k = 1; k <= n; k++) {
    hTrue[k] = hFalse[k - 1];
    hFalse[k] = hTrue[k - 1] + hFalse[k - 1];
  }
  return { hFalse, hTrue };
}

function binaryStringsAvoiding00Count(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return noZeroZeroTable(n).hFalse[n];
}

function binaryStringsAvoiding00Unrank(p: number[], r: number): number[] {
  const n = p[0];
  if (n <= 0) return [];
  const { hFalse, hTrue } = noZeroZeroTable(n);
  const total = hFalse[n];
  let rem = normRank(r, total);
  const w: number[] = [];
  let prevZero = false;
  for (let i = 0; i < n; i++) {
    const k = n - 1 - i; // positions remaining after this one
    if (prevZero) {
      w.push(1); // forced: no two consecutive 0s
      prevZero = false;
    } else {
      const block0 = hTrue[k];
      if (rem < block0) {
        w.push(0);
        prevZero = true;
      } else {
        rem -= block0;
        w.push(1);
        prevZero = false;
      }
    }
  }
  return w;
}

function binaryStringsAvoiding00Rank(e: any, p: number[]): number {
  const n = p[0];
  if (n <= 0) return 0;
  const { hTrue } = noZeroZeroTable(n);
  const w = e as number[];
  let rank = 0;
  let prevZero = false;
  for (let i = 0; i < n; i++) {
    const k = n - 1 - i;
    const bit = w[i];
    if (prevZero) {
      prevZero = false; // forced bit, no rank contribution
    } else if (bit === 0) {
      prevZero = true;
    } else {
      rank += hTrue[k];
      prevZero = false;
    }
  }
  return rank;
}

function binaryStringsAvoiding00Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  let prevZero = false;
  for (const b of e) {
    if (b !== 0 && b !== 1) return false;
    if (b === 0 && prevZero) return false;
    prevZero = b === 0;
  }
  return true;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "RestrictedGrowthStrings",
    paramCount: 1,
    kind: "ints",
    count: restrictedGrowthStringsCount,
    unrank: restrictedGrowthStringsUnrank,
    rank: restrictedGrowthStringsRank,
    valid: restrictedGrowthStringsValid,
  },
  {
    head: "BinaryStringsAvoiding00",
    paramCount: 1,
    kind: "ints",
    count: binaryStringsAvoiding00Count,
    unrank: binaryStringsAvoiding00Unrank,
    rank: binaryStringsAvoiding00Rank,
    valid: binaryStringsAvoiding00Valid,
  },
];
