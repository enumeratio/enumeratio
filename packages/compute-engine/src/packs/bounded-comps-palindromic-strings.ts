// pack-j.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// CompositionsBoundedParts(n,m) and PalindromicBinaryStrings(n). Self-contained:
// no imports, no I/O, plain JS numbers/arrays. See .scratch/pack-j-selfcert.mts
// for the exhaustive rank(unrank(p,r),p)===r certification.
//
// WeakCompositionsBoundedParts was considered and dropped: "weak composition"
// with a fixed part count is standard, but a length-unbounded weak
// composition bounded only by part-size m has infinitely many representations
// of n (arbitrarily many zero parts) unless the length is itself part of the
// element or a separate parameter — the spec text flagged this ambiguity
// itself ("no, skip if ambiguous"), so it is omitted rather than guessed at.

import type { PackEntry } from "./types.js";

// ---- CompositionsBoundedParts(n,m) -----------------------------------------
// Ordered compositions of n whose parts each lie in {1,...,m}. DP:
// c[0] = 1 (the empty composition); c[rem] = sum_{part=1}^{min(rem,m)} c[rem-part].
// c is indexed by remaining sum only (0..n) so the same table serves every
// step of both unrank and rank.
//
// unrank walks rem = n down to 0, at each step trying part = 1, 2, ... in
// order; block = c[rem-part] is the number of completions that start with
// that part. If r falls inside the block it is chosen (recurse into
// rem-part with the same r); otherwise r -= block and the next part is
// tried. rank replays the identical left-to-right, ascending-part
// enumeration order and sums the skipped blocks, so it is the exact inverse.

function compBoundedCountTable(n: number, m: number): number[] {
  const c = new Array(n + 1).fill(0);
  c[0] = 1;
  for (let rem = 1; rem <= n; rem++) {
    const upper = Math.min(rem, m);
    let total = 0;
    for (let part = 1; part <= upper; part++) total += c[rem - part];
    c[rem] = total;
  }
  return c;
}

function compositionsBoundedPartsCount(p: number[]): number {
  const [n, m] = p;
  if (n < 0) return 0;
  return compBoundedCountTable(n, m)[n];
}

function compositionsBoundedPartsUnrank(p: number[], r: number): number[] {
  const [n, m] = p;
  const c = compBoundedCountTable(n, m);
  const result: number[] = [];
  let rem = n;
  let rr = r;
  while (rem > 0) {
    const upper = Math.min(rem, m);
    let chosen = -1;
    for (let part = 1; part <= upper; part++) {
      const block = c[rem - part];
      if (rr < block) {
        chosen = part;
        break;
      }
      rr -= block;
    }
    result.push(chosen);
    rem -= chosen;
  }
  return result;
}

function compositionsBoundedPartsRank(e: any, p: number[]): number {
  const [n, m] = p;
  const c = compBoundedCountTable(n, m);
  let rem = n;
  let rank = 0;
  for (const part of e) {
    for (let v = 1; v < part; v++) rank += c[rem - v];
    rem -= part;
  }
  return rank;
}

function compositionsBoundedPartsValid(e: any, p: number[]): boolean {
  const [n, m] = p;
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const x of e) {
    if (!Number.isInteger(x) || x < 1 || x > m) return false;
    sum += x;
  }
  return sum === n;
}

// ---- PalindromicBinaryStrings(n) -------------------------------------------
// 0/1 strings of length n that read the same forwards and backwards. The
// first half = ceil(n/2) bits are free; every other bit is a mirrored copy
// (s[i] = s[n-1-i]). Count = 2^half. unrank reads the half free bits off r
// as a fixed-width binary number (MSB-first) and mirrors them out to length
// n; rank re-packs the same half bits MSB-first — same bit order both
// directions, so they are exact inverses.

function palindromicBinaryStringsCount(p: number[]): number {
  const n = p[0];
  const half = Math.ceil(n / 2);
  return Math.pow(2, half);
}

function palindromicBinaryStringsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const half = Math.ceil(n / 2);
  const free: number[] = [];
  for (let i = 0; i < half; i++) free.push((r >> (half - 1 - i)) & 1);
  const s: number[] = new Array(n);
  for (let i = 0; i < n; i++) s[i] = i < half ? free[i] : free[n - 1 - i];
  return s;
}

function palindromicBinaryStringsRank(e: any, p: number[]): number {
  const n = p[0];
  const half = Math.ceil(n / 2);
  let r = 0;
  for (let i = 0; i < half; i++) r = (r << 1) | (e[i] & 1);
  return r >>> 0;
}

function palindromicBinaryStringsValid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  for (const x of e) if (x !== 0 && x !== 1) return false;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    if (e[i] !== e[n - 1 - i]) return false;
  }
  return true;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "CompositionsBoundedParts",
    paramCount: 2,
    kind: "ints",
    count: compositionsBoundedPartsCount,
    unrank: compositionsBoundedPartsUnrank,
    rank: compositionsBoundedPartsRank,
    valid: compositionsBoundedPartsValid,
  },
  {
    head: "PalindromicBinaryStrings",
    paramCount: 1,
    kind: "ints",
    count: palindromicBinaryStringsCount,
    unrank: palindromicBinaryStringsUnrank,
    rank: palindromicBinaryStringsRank,
    valid: palindromicBinaryStringsValid,
  },
];
