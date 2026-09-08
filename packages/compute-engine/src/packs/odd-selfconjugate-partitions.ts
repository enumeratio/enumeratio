// pack-e.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// PartitionsIntoOddParts(n) and SelfConjugatePartitions(n). Self-contained: no
// imports, no I/O, plain JS numbers/arrays. See .scratch/pack-e-selfcert.mts
// for the exhaustive rank(unrank(p,r),p)===r certification over n=0..12.

import type { PackEntry } from "./types.js";

// ---- shared helper ---------------------------------------------------------

// Largest odd number <= x, or 0 if x < 1 (meaning "no valid odd part left").
function normalizeOdd(x: number): number {
  if (x < 1) return 0;
  return x % 2 === 0 ? x - 1 : x;
}

// ---- PartitionsIntoOddParts(n) --------------------------------------------
// Partitions of n where every part is odd (repeats allowed), listed
// weakly-decreasing. Count = q(n), the number of partitions of n into
// distinct parts (Euler's odd/distinct theorem) — OEIS A000009.
//
// DP: countOddParts(n, maxPart) = partitions of n using odd parts <= maxPart.
// Split by whether the top allowed odd value `mp` is used at all:
//   - "skip" branch: partitions using only parts <= mp-2 -> countOddParts(n, mp-2)
//   - "use" branch: use one copy of mp, ceiling stays mp (repeats allowed)
//     -> countOddParts(n-mp, mp)
// unrank/rank walk the same skip-then-use split at every step, so they are
// exact inverses of each other by construction (skip block occupies the low
// ranks, use block the high ranks).

const countOddPartsMemo = new Map<string, number>();

function countOddParts(n: number, maxPart: number): number {
  if (n === 0) return 1;
  const mp = normalizeOdd(maxPart);
  if (mp < 1 || n < 0) return 0;
  const key = n + "," + mp;
  const cached = countOddPartsMemo.get(key);
  if (cached !== undefined) return cached;
  const val = countOddParts(n, mp - 2) + countOddParts(n - mp, mp);
  countOddPartsMemo.set(key, val);
  return val;
}

function unrankOddParts(n: number, maxPart: number, r: number): number[] {
  if (n === 0) return [];
  const mp = normalizeOdd(maxPart);
  const countSkip = countOddParts(n, mp - 2);
  if (r < countSkip) return unrankOddParts(n, mp - 2, r);
  return [mp, ...unrankOddParts(n - mp, mp, r - countSkip)];
}

function rankOddParts(parts: number[], n: number, maxPart: number): number {
  const mp = normalizeOdd(maxPart);
  if (parts.length === 0) return 0;
  if (parts[0] < mp) return rankOddParts(parts, n, mp - 2);
  const countSkip = countOddParts(n, mp - 2);
  return countSkip + rankOddParts(parts.slice(1), n - mp, mp);
}

function validOddParts(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  if (e.length === 0) return n === 0;
  for (const x of e) {
    if (!Number.isInteger(x) || x < 1 || x % 2 === 0) return false;
  }
  for (let i = 0; i + 1 < e.length; i++) {
    if (e[i] < e[i + 1]) return false; // weakly decreasing
  }
  const sum = e.reduce((a: number, b: number) => a + b, 0);
  return sum === n;
}

// ---- SelfConjugatePartitions(n) --------------------------------------------
// Partitions of n equal to their own conjugate. Bijection (classic): a
// self-conjugate partition <-> the strictly-decreasing sequence of odd hook
// lengths d_1 > d_2 > ... > d_k running down its main diagonal (Durfee
// square side k). Hook length at diagonal cell i is always odd for a
// self-conjugate partition (arm == leg there), and distinct because hook
// lengths strictly decrease along any diagonal. Count = partitions of n into
// distinct odd parts — OEIS A000700.
//
// Forward (unrank): unrank a strictly-decreasing distinct-odd-parts sequence
// d[], set a_i = (d_i-1)/2 (arm=leg at diagonal cell i, 1-indexed), and
// L_i = i + a_i is both the row length AND column length for i=1..k. Rows
// beyond the Durfee square are filled by conjugate symmetry: row i (i>k) =
// #{j<=k : L_j >= i}.
//
// Backward (rank): recover k as the Durfee square side (max i with
// lambda[i-1] >= i), then d_i = 2*(lambda[i-1]-i)+1 for i=1..k, and rank
// that distinct-odd-parts sequence.

const countDistinctOddMemo = new Map<string, number>();

function countDistinctOdd(m: number, maxOdd: number): number {
  if (m === 0) return 1;
  const mo = normalizeOdd(maxOdd);
  if (mo < 1 || m < 0) return 0;
  const key = m + "," + mo;
  const cached = countDistinctOddMemo.get(key);
  if (cached !== undefined) return cached;
  const val = countDistinctOdd(m, mo - 2) + countDistinctOdd(m - mo, mo - 2);
  countDistinctOddMemo.set(key, val);
  return val;
}

function unrankDistinctOdd(m: number, maxOdd: number, r: number): number[] {
  if (m === 0) return [];
  const mo = normalizeOdd(maxOdd);
  const countSkip = countDistinctOdd(m, mo - 2);
  if (r < countSkip) return unrankDistinctOdd(m, mo - 2, r);
  return [mo, ...unrankDistinctOdd(m - mo, mo - 2, r - countSkip)];
}

function rankDistinctOdd(parts: number[], m: number, maxOdd: number): number {
  const mo = normalizeOdd(maxOdd);
  if (parts.length === 0) return 0;
  if (parts[0] < mo) return rankDistinctOdd(parts, m, mo - 2);
  const countSkip = countDistinctOdd(m, mo - 2);
  return countSkip + rankDistinctOdd(parts.slice(1), m - mo, mo - 2);
}

// Fold distinct odd hook lengths d_1 > ... > d_k into a self-conjugate partition.
function selfConjugateFromHooks(ds: number[]): number[] {
  const k = ds.length;
  if (k === 0) return [];
  const L = ds.map((d, idx) => idx + 1 + (d - 1) / 2); // row/col length i = i + a_i
  const lambda: number[] = L.slice();
  let i = k + 1;
  for (;;) {
    let cnt = 0;
    for (const Lj of L) if (Lj >= i) cnt++;
    if (cnt === 0) break;
    lambda.push(cnt);
    i++;
  }
  return lambda;
}

// Recover the distinct odd hook lengths along the diagonal of a self-conjugate partition.
function hooksFromSelfConjugate(lambda: number[]): number[] {
  let k = 0;
  for (let i = 1; i <= lambda.length; i++) {
    if (lambda[i - 1] >= i) k = i;
    else break; // lambda[i-1]-i is non-increasing, safe to stop
  }
  const ds: number[] = [];
  for (let i = 1; i <= k; i++) ds.push(2 * (lambda[i - 1] - i) + 1);
  return ds;
}

function conjugatePartition(lam: number[]): number[] {
  if (lam.length === 0) return [];
  const maxPart = lam[0];
  const conj: number[] = [];
  for (let j = 1; j <= maxPart; j++) {
    let c = 0;
    for (const part of lam) {
      if (part >= j) c++;
      else break; // lam weakly decreasing
    }
    conj.push(c);
  }
  return conj;
}

function validSelfConjugate(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  if (e.length === 0) return n === 0;
  for (const x of e) {
    if (!Number.isInteger(x) || x < 1) return false;
  }
  for (let i = 0; i + 1 < e.length; i++) {
    if (e[i] < e[i + 1]) return false; // weakly decreasing
  }
  const sum = e.reduce((a: number, b: number) => a + b, 0);
  if (sum !== n) return false;
  const conj = conjugatePartition(e);
  if (conj.length !== e.length) return false;
  for (let i = 0; i < e.length; i++) if (conj[i] !== e[i]) return false;
  return true;
}

// ---- entries ----------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "PartitionsIntoOddParts",
    paramCount: 1,
    kind: "ints",
    count: (p) => countOddParts(p[0], p[0]),
    unrank: (p, r) => unrankOddParts(p[0], p[0], r),
    rank: (e, p) => rankOddParts(e as number[], p[0], p[0]),
    valid: (e, p) => validOddParts(e, p),
  },
  {
    head: "SelfConjugatePartitions",
    paramCount: 1,
    kind: "ints",
    count: (p) => countDistinctOdd(p[0], p[0]),
    unrank: (p, r) => {
      const n = p[0];
      const ds = unrankDistinctOdd(n, n, r);
      return selfConjugateFromHooks(ds);
    },
    rank: (e, p) => {
      const n = p[0];
      const ds = hooksFromSelfConjugate(e as number[]);
      return rankDistinctOdd(ds, n, n);
    },
    valid: (e, p) => validSelfConjugate(e, p),
  },
];
