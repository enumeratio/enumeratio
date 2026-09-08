// pack-k.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// CompositionsIntoParts123(n) and BinaryStringsAvoiding111(n). Self-contained:
// no imports, no I/O, plain JS numbers/arrays. Both counts follow a
// tribonacci-shaped recurrence and both unrank via the same "count
// completions, subtract blocks" technique: build a small DP table once per
// call, then walk it front-to-back trying the lexicographically-smallest
// choice (smallest part / a 0-bit) first, falling through to the next choice
// when the rank doesn't fit in that choice's block. See
// .scratch/pack-k-selfcert.mts for the exhaustive rank(unrank(p,r),p)===r
// certification over n=0..14.

import type { PackEntry } from "./types.js";

// ---- CompositionsIntoParts123(n) -------------------------------------------
// Compositions of n (ordered sequences of positive-integer parts summing to
// n) with every part restricted to {1,2,3}. c(0)=1 (the empty composition);
// c(n)=c(n-1)+c(n-2)+c(n-3) for n>=1 (treating c(negative)=0) — the last part
// is 1, 2, or 3, and the rest is any composition of the remainder. This is
// the tribonacci sequence: 1,1,2,4,7,13,24,...
//
// Elements are the flat list of parts, e.g. n=3 -> [1,1,1],[1,2],[2,1],[3] in
// that lex order (smallest first part first). unrank/rank both build the
// table c(0..n) once, then walk parts front-to-back: for a given remaining
// sum `rem`, trying first-part v=1,2,3 in turn, each choice accounting for a
// block of size c(rem-v) completions.

function compositions123CountTable(n: number): number[] {
  const c = new Array(n + 1).fill(0);
  c[0] = 1;
  for (let i = 1; i <= n; i++) {
    c[i] = (i >= 1 ? c[i - 1] : 0) + (i >= 2 ? c[i - 2] : 0) + (i >= 3 ? c[i - 3] : 0);
  }
  return c;
}

function compositions123Count(p: number[]): number {
  const n = p[0];
  return compositions123CountTable(n)[n];
}

function compositions123Unrank(p: number[], r: number): number[] {
  const n = p[0];
  const c = compositions123CountTable(n);
  const parts: number[] = [];
  let rem = n;
  let rr = r;
  while (rem > 0) {
    for (let v = 1; v <= Math.min(rem, 3); v++) {
      const block = c[rem - v];
      if (rr < block) {
        parts.push(v);
        rem -= v;
        break;
      }
      rr -= block;
    }
  }
  return parts;
}

function compositions123Rank(e: number[], p: number[]): number {
  const n = p[0];
  const c = compositions123CountTable(n);
  let rem = n;
  let rank = 0;
  for (const v of e) {
    for (let vv = 1; vv < v; vv++) rank += c[rem - vv];
    rem -= v;
  }
  return rank;
}

function compositions123Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e)) return false;
  let sum = 0;
  for (const v of e) {
    if (v !== 1 && v !== 2 && v !== 3) return false;
    sum += v;
  }
  return sum === n;
}

// ---- BinaryStringsAvoiding111(n) -------------------------------------------
// 0/1 strings of length n with no run of three consecutive 1s. Let
// h(rem,t) = number of ways to fill `rem` more bits given `t` trailing 1s so
// far (t in {0,1,2}): h(rem,t) = h(rem-1,0) [place a 0, always legal, resets
// the run] + (t<2 ? h(rem-1,t+1) : 0) [place a 1, only legal below the
// 3-run cap]. h(0,t)=1 for all t. Count(n) = h(n,0); this is the same
// tribonacci-shaped recurrence with different seed values (1,2,4,7,13,24,...
// for n=0..5).
//
// unrank/rank walk left-to-right through the string carrying (rem,t),
// preferring 0 over 1 at each position (0's completions form a block of size
// h(rem-1,0) that comes first in rank order).

function binAvoid111Table(n: number): number[][] {
  const h: number[][] = new Array(n + 1);
  h[0] = [1, 1, 1];
  for (let rem = 1; rem <= n; rem++) {
    const prev = h[rem - 1];
    h[rem] = [prev[0] + prev[1], prev[0] + prev[2], prev[0]];
  }
  return h;
}

function binAvoid111Count(p: number[]): number {
  const n = p[0];
  return binAvoid111Table(n)[n][0];
}

function binAvoid111Unrank(p: number[], r: number): number[] {
  const n = p[0];
  const h = binAvoid111Table(n);
  const bits: number[] = [];
  let rem = n;
  let t = 0;
  let rr = r;
  while (rem > 0) {
    const zeroBlock = h[rem - 1][0];
    if (rr < zeroBlock) {
      bits.push(0);
      t = 0;
    } else {
      rr -= zeroBlock;
      bits.push(1);
      t = t + 1;
    }
    rem--;
  }
  return bits;
}

function binAvoid111Rank(e: number[], p: number[]): number {
  const n = p[0];
  const h = binAvoid111Table(n);
  let rem = n;
  let rank = 0;
  for (const bit of e) {
    if (bit === 1) rank += h[rem - 1][0];
    rem--;
  }
  return rank;
}

function binAvoid111Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  let run = 0;
  for (const v of e) {
    if (v !== 0 && v !== 1) return false;
    if (v === 1) {
      run++;
      if (run >= 3) return false;
    } else {
      run = 0;
    }
  }
  return true;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "CompositionsIntoParts123",
    paramCount: 1,
    kind: "ints",
    count: compositions123Count,
    unrank: compositions123Unrank,
    rank: compositions123Rank,
    valid: compositions123Valid,
  },
  {
    head: "BinaryStringsAvoiding111",
    paramCount: 1,
    kind: "ints",
    count: binAvoid111Count,
    unrank: binAvoid111Unrank,
    rank: binAvoid111Rank,
    valid: binAvoid111Valid,
  },
];
