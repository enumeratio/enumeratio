// Words — binary strings (balanced, palindromic, factor-avoiding), restricted growth strings,
// necklaces/Lyndon words, parenthesizations (Groupings), and revolving-door Gray-code k-subsets.
// Pure-TS rank/unrank kernels: no I/O beyond PackEntry/_shared/kernels-extra, plain JS
// numbers/arrays. Consolidated from eight parallel-authored packs; every kernel's
// rank(unrank(p,r),p)===r certification lives in test/selfcert.test.ts.

import type { PackEntry } from "./types.js";
import { binomial } from "./_shared.js";
import { CatalanNumber } from "../kernels-extra.js";

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ---- BalancedBinaryStrings(n) ------------------------------------------------
// 0/1 strings of length 2n with exactly n ones and n zeros. Count = C(2n,n):
// choose which n of the 2n positions hold a 1.

// Colex (combinatorial number system) unrank of a k-subset of {0,...,N-1}.
// Standard combinadic decomposition: find the subset {c_k>...>c_1} such that
// r = C(c_k,k)+C(c_{k-1},k-1)+...+C(c_1,1), by greedily taking the largest
// candidate at each digit whose binomial coefficient still fits under the
// remaining rank. Returns the subset sorted ascending.
function kSubsetUnrank(N: number, k: number, r: number): number[] {
  const descending: number[] = [];
  let rem = r;
  let upperBound = N - 1; // largest value still eligible (must stay < previous pick)
  for (let kk = k; kk >= 1; kk--) {
    let c = upperBound;
    while (binomial(c, kk) > rem) c--;
    descending.push(c);
    rem -= binomial(c, kk);
    upperBound = c - 1;
  }
  return descending.reverse();
}

// Exact inverse of kSubsetUnrank: given a subset sorted ascending, recover
// its colex rank as sum_j C(e[j], j+1) (the same combinadic sum, read off
// an ascending array instead of descending).
function kSubsetRank(ascending: number[]): number {
  let rank = 0;
  for (let j = 0; j < ascending.length; j++) rank += binomial(ascending[j], j + 1);
  return rank;
}

function balancedBinaryStringsCount(p: number[]): number {
  const n = p[0];
  return binomial(2 * n, n);
}

function balancedBinaryStringsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const N = 2 * n;
  const ones = kSubsetUnrank(N, n, r);
  const s = new Array(N).fill(0);
  for (const pos of ones) s[pos] = 1;
  return s;
}

function balancedBinaryStringsRank(e: number[], p: number[]): number {
  const positions: number[] = [];
  for (let i = 0; i < e.length; i++) if (e[i] === 1) positions.push(i);
  return kSubsetRank(positions);
}

function balancedBinaryStringsValid(e: any, p: number[]): boolean {
  const n = p[0];
  const N = 2 * n;
  if (!Array.isArray(e) || e.length !== N) return false;
  let ones = 0;
  for (const v of e) {
    if (v !== 0 && v !== 1) return false;
    if (v === 1) ones++;
  }
  return ones === n;
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

// ---- RestrictedGrowthStrings(n) / BinaryStringsAvoiding00(n) ---------------

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

// ─── SetPartitionsIntoAtMostKBlocks companion: BinaryStringsAvoiding010(n): length-n strings over
// {0,1} with no occurrence of the factor "010", counted by g(n,0) below (1,2,4,7,13,24,44,81,... —
// n=3 gives 7 = 2^3 - 1, the single excluded string "010"). DP over the KMP-automaton state for
// pattern "010": state 0 = no relevant match in progress (or empty prefix), state 1 = trailing
// suffix matches "0", state 2 = trailing suffix matches "01"; reading a bit that would complete
// "010" (bit 0 from state 2) is the ONE forbidden transition. g(t,s) = valid completions of t
// remaining positions from state s: g(0,s)=1; g(t,0)=g(t-1,1)+g(t-1,0) (bit0->1, bit1->0);
// g(t,1)=g(t-1,1)+g(t-1,2) (bit0->1, bit1->2); g(t,2)=g(t-1,0) (bit0 is the forbidden completion,
// excluded; bit1->0). count(n) = g(n,0). unrank tries bit 0 then bit 1 at each position (skipping a
// dead transition entirely), counting completions that still avoid "010"; rank replays the identical
// walk. ──────────────────────────────────────────────────────────────────────────────────────────

function stepState010(s: number, bit: number): number {
  // Returns -1 for the one forbidden transition (completing "010" from state 2 on bit 0).
  if (s === 0) return bit === 0 ? 1 : 0;
  if (s === 1) return bit === 0 ? 1 : 2;
  return bit === 0 ? -1 : 0; // s === 2
}

function noZeroOneZeroTable(n: number): number[][] {
  const g: number[][] = [];
  for (let t = 0; t <= n; t++) g.push([0, 0, 0]);
  g[0] = [1, 1, 1];
  for (let t = 1; t <= n; t++) {
    g[t][0] = g[t - 1][1] + g[t - 1][0];
    g[t][1] = g[t - 1][1] + g[t - 1][2];
    g[t][2] = g[t - 1][0];
  }
  return g;
}

function binaryStringsAvoiding010Count(p: number[]): number {
  const n = p[0];
  if (n < 0) return 0;
  return noZeroOneZeroTable(n)[n][0];
}

function binaryStringsAvoiding010Unrank(p: number[], r: number): number[] {
  const n = p[0];
  if (n <= 0) return [];
  const g = noZeroOneZeroTable(n);
  const total = g[n][0];
  let rem = normRank(r, total);
  const w: number[] = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const t = n - 1 - i; // remaining positions after this one
    let chosen = -1;
    for (const bit of [0, 1]) {
      const ns = stepState010(s, bit);
      if (ns === -1) continue; // dead transition: not a legal choice here
      const block = g[t][ns];
      if (rem < block) { chosen = bit; s = ns; break; }
      rem -= block;
    }
    w.push(chosen);
  }
  return w;
}

function binaryStringsAvoiding010Rank(e: any, p: number[]): number {
  const n = p[0];
  if (n <= 0) return 0;
  const g = noZeroOneZeroTable(n);
  const w = e as number[];
  let rank = 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const t = n - 1 - i;
    const bit = w[i];
    const ns0 = stepState010(s, 0);
    if (bit === 0) {
      s = stepState010(s, 0);
    } else {
      if (ns0 !== -1) rank += g[t][ns0]; // weight of the (skipped) bit-0 branch, if it existed
      s = stepState010(s, 1);
    }
  }
  return rank;
}

function binaryStringsAvoiding010Valid(e: any, p: number[]): boolean {
  const n = p[0];
  if (!Array.isArray(e) || e.length !== n) return false;
  for (const b of e) if (b !== 0 && b !== 1) return false;
  for (let i = 0; i + 3 <= e.length; i++) {
    if (e[i] === 0 && e[i + 1] === 1 && e[i + 2] === 0) return false;
  }
  return true;
}

// ─── shared machinery: a length-n {0,1}-string avoiding a fixed binary factor PATTERN ─────────────────
// (BinaryStringsAvoiding101 and BinaryStringsAvoiding0101 below are instances of this). The automaton
// is the classic KMP failure-function construction: state q in 0..m (m = pattern length) is "the longest
// suffix of the string read so far that is also a prefix of PATTERN" — q===m means PATTERN has occurred
// (the "dead" state, excluded from every count below since we only count strings that AVOID it). delta[q]
// [c] is the next state on reading bit c. buildCompletionsTable(n) then gives table[k][q] = number of
// length-k completions from state q that never touch the dead state; count/unrank/rank all read off that
// same table (unrank/rank do NOT reuse a separate machine — the DFA driving them here is this one; the
// independent cross-check lives only in valid(), via a bare substring scan). ───────────────────────────

function kmpFailure(pattern: number[]): number[] {
  const m = pattern.length;
  const pi = new Array(m).fill(0);
  let k = 0;
  for (let i = 1; i < m; i++) {
    while (k > 0 && pattern[i] !== pattern[k]) k = pi[k - 1];
    if (pattern[i] === pattern[k]) k++;
    pi[i] = k;
  }
  return pi;
}

function buildDelta(pattern: number[]): number[][] {
  const m = pattern.length;
  const pi = kmpFailure(pattern);
  // delta[q][c], q=0..m (q===m is the dead/pattern-complete state), c in {0,1}.
  const delta: number[][] = [];
  for (let q = 0; q <= m; q++) delta.push([0, 0]);
  for (let q = 0; q <= m; q++) {
    for (const c of [0, 1]) {
      if (q < m && pattern[q] === c) delta[q][c] = q + 1;
      else if (q === 0) delta[q][c] = 0;
      else delta[q][c] = delta[pi[q - 1]][c]; // pi[q-1] < q: already filled in this loop
    }
  }
  return delta;
}

// table[k][q] = number of length-k completions from state q that never reach the dead state m.
// Iterative (not recursive) so it stays stack-safe for large n.
function buildCompletionsTable(delta: number[][], m: number, n: number): number[][] {
  const table: number[][] = new Array(n + 1);
  table[0] = new Array(m).fill(1); // nothing left to place: exactly one (empty) completion from any live state
  for (let k = 1; k <= n; k++) {
    const prev = table[k - 1];
    const row = new Array(m).fill(0);
    for (let q = 0; q < m; q++) {
      let total = 0;
      for (const c of [0, 1]) {
        const nq = delta[q][c];
        if (nq < m) total += prev[nq];
      }
      row[q] = total;
    }
    table[k] = row;
  }
  return table;
}

function factorAvoidingCount(pattern: number[], n: number): number {
  if (n < 0) return 0;
  const m = pattern.length;
  const delta = buildDelta(pattern);
  return buildCompletionsTable(delta, m, n)[n][0];
}

function factorAvoidingUnrank(pattern: number[], n: number, r: number): number[] {
  if (n <= 0) return [];
  const m = pattern.length;
  const delta = buildDelta(pattern);
  const table = buildCompletionsTable(delta, m, n);
  const total = table[n][0];
  let rem = normRank(r, total);
  let state = 0;
  const bits: number[] = [];
  for (let i = 0; i < n; i++) {
    const remaining = n - i - 1;
    const nq0 = delta[state][0];
    const c0 = nq0 < m ? table[remaining][nq0] : 0;
    if (rem < c0) {
      bits.push(0);
      state = nq0;
    } else {
      rem -= c0;
      bits.push(1);
      state = delta[state][1];
    }
  }
  return bits;
}

function factorAvoidingRank(pattern: number[], e: any): number {
  const bits = e as number[];
  const n = bits.length;
  if (n <= 0) return 0;
  const m = pattern.length;
  const delta = buildDelta(pattern);
  const table = buildCompletionsTable(delta, m, n);
  let state = 0;
  let r = 0;
  for (let i = 0; i < n; i++) {
    const remaining = n - i - 1;
    const bit = bits[i];
    if (bit === 1) {
      const nq0 = delta[state][0];
      r += nq0 < m ? table[remaining][nq0] : 0;
    }
    state = delta[state][bit];
  }
  return r;
}

// Independent avoidance check — a bare substring scan, deliberately NOT built from delta/table above,
// so valid() can't agree with a bug shared by count/unrank/rank's shared automaton.
function containsFactor(bits: number[], pattern: number[]): boolean {
  const n = bits.length;
  const m = pattern.length;
  for (let i = 0; i + m <= n; i++) {
    let match = true;
    for (let j = 0; j < m; j++) {
      if (bits[i + j] !== pattern[j]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

function factorAvoidingValid(pattern: number[], e: any, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  for (const b of e) {
    if (b !== 0 && b !== 1) return false;
  }
  return !containsFactor(e, pattern);
}

// ─── BinaryStringsAvoiding101(n): length-n strings over {0,1} with no occurrence of the factor "101". ──

const PATTERN_101 = [1, 0, 1];

function binaryStringsAvoiding101Count(p: number[]): number {
  return factorAvoidingCount(PATTERN_101, p[0]);
}
function binaryStringsAvoiding101Unrank(p: number[], r: number): number[] {
  return factorAvoidingUnrank(PATTERN_101, p[0], r);
}
function binaryStringsAvoiding101Rank(e: any, _p: number[]): number {
  return factorAvoidingRank(PATTERN_101, e);
}
function binaryStringsAvoiding101Valid(e: any, p: number[]): boolean {
  return factorAvoidingValid(PATTERN_101, e, p[0]);
}

// ─── BinaryStringsAvoiding0101(n): length-n strings over {0,1} with no occurrence of the factor "0101". ─

const PATTERN_0101 = [0, 1, 0, 1];

function binaryStringsAvoiding0101Count(p: number[]): number {
  return factorAvoidingCount(PATTERN_0101, p[0]);
}
function binaryStringsAvoiding0101Unrank(p: number[], r: number): number[] {
  return factorAvoidingUnrank(PATTERN_0101, p[0], r);
}
function binaryStringsAvoiding0101Rank(e: any, _p: number[]): number {
  return factorAvoidingRank(PATTERN_0101, e);
}
function binaryStringsAvoiding0101Valid(e: any, p: number[]): boolean {
  return factorAvoidingValid(PATTERN_0101, e, p[0]);
}

// ─── Necklaces(n,k) / LyndonWords(n,k): one underlying fact (the classical Lyndon-word
// factorization of a necklace): the lex-smallest rotation of ANY length-n word decomposes uniquely
// as L^(n/d), where d | n is the word's minimal period and L is a LYNDON WORD of length d (the
// minimal rotation of a primitive string is always strictly smaller than every one of its own
// other rotations, i.e. a Lyndon word, by definition). That gives a bijection
//   {necklace reps of length n} <-> { (d, L) : d | n, L a Lyndon word of length d }
// which is exactly the identity Necklace(n,k) = Σ_{d|n} LyndonCount(d,k) (checked against the given
// Σ φ(d)·k^(n/d) formula). unrank/rank for Necklaces walk the divisors of n in increasing order (a
// deterministic total order: "which divisor-block, then which Lyndon word inside it") instead of
// prefix-counting directly over rotations of words, which is both much simpler to get exactly right
// and reduces to the same LyndonWords machinery this file already needs for its second collection.

// ─── number theory: Möbius mu, Euler phi, divisors — inlined, no shared dependency ─────────────────

/** All divisors of n (n >= 1), ascending. */
function divisorsOf(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      out.push(d);
      if (d !== n / d) out.push(n / d);
    }
  }
  return out.sort((a, b) => a - b);
}

/** Möbius μ(n) via trial-division prime factorization. */
function mobiusMu(n: number): number {
  if (n === 1) return 1;
  let m = n;
  let primeCount = 0;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      m /= p;
      if (m % p === 0) return 0; // p^2 | n
      primeCount++;
    }
  }
  if (m > 1) primeCount++;
  return primeCount % 2 === 0 ? 1 : -1;
}

/** Euler φ(n) via trial-division prime factorization. */
function eulerPhi(n: number): number {
  let result = n;
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      while (m % p === 0) m /= p;
      result -= result / p;
    }
  }
  if (m > 1) result -= result / m;
  return Math.round(result);
}

// ─── array helpers ───────────────────────────────────────────────────────────────────────────────

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Lexicographic compare of two same-length arrays: <0, 0, or >0. */
function compareArrays(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function rotateLeft(w: number[], s: number): number[] {
  const n = w.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = w[(i + s) % n];
  return out;
}

/** Is `d` a period of `w` (w repeats its own first-d-elements block)? Assumes d | w.length. */
function isPeriod(w: number[], d: number): boolean {
  for (let i = d; i < w.length; i++) if (w[i] !== w[i % d]) return false;
  return true;
}

// ─── FKM (Fredricksen–Kessler–Maiorana / Duval) algorithm: all Lyndon words of length <= n over
// the 0-indexed alphabet {0..k-1}, generated in lexicographic order. Classical "necklace/de Bruijn
// generation" successor step: extend the current word periodically to length n, strip trailing
// (k-1)'s, then bump the new last letter — this walks every Lyndon word of length <= n exactly
// once, in lex order. ──────────────────────────────────────────────────────────────────────────

function fkmLyndonWordsUpTo(n: number, k: number): number[][] {
  const out: number[][] = [];
  if (n <= 0 || k <= 0) return out;
  let w: number[] = [0];
  while (w.length > 0) {
    out.push(w.slice());
    const m = w.length;
    while (w.length < n) w.push(w[w.length - m]);
    while (w.length > 0 && w[w.length - 1] === k - 1) w.pop();
    if (w.length > 0) w[w.length - 1] += 1;
  }
  return out;
}

/** Lyndon words of length EXACTLY n over alphabet {1..k}, in lex order (1-indexed letters). */
function lyndonWordsExact(n: number, k: number): number[][] {
  if (n <= 0 || k <= 0) return [];
  return fkmLyndonWordsUpTo(n, k)
    .filter((w) => w.length === n)
    .map((w) => w.map((x) => x + 1));
}

/** |{Lyndon words of length n over a k-ary alphabet}| = (1/n) Σ_{d|n} μ(d)·k^(n/d). */
function lyndonCount(n: number, k: number): number {
  if (n <= 0 || k <= 0) return 0;
  let sum = 0;
  for (const d of divisorsOf(n)) sum += mobiusMu(d) * Math.pow(k, n / d);
  return Math.round(sum / n);
}

// ─── Necklaces(n,k): equivalence classes of length-n words over {1..k} under rotation, represented
// by the lexicographically smallest rotation. count(n,k) = (1/n) Σ_{d|n} φ(d)·k^(n/d) (the given
// closed form). unrank/rank use the Lyndon-factorization bijection above: walk divisors d of n in
// increasing order, each contributing a block of size LyndonCount(d,k) (one necklace rep per Lyndon
// word of length d, formed by repeating it n/d times); locate/replay the block containing r. ──────

function necklacesCount(p: number[]): number {
  const n = p[0];
  const k = p[1];
  if (k <= 0) return 0;
  if (n === 0) return 1;
  if (n < 0) return 0;
  let sum = 0;
  for (const d of divisorsOf(n)) sum += eulerPhi(d) * Math.pow(k, n / d);
  return Math.round(sum / n);
}

function necklacesUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const k = p[1];
  if (n <= 0) return [];
  const total = necklacesCount(p);
  let rem = normRank(r, total);
  for (const d of divisorsOf(n)) {
    const block = lyndonCount(d, k);
    if (rem < block) {
      const L = lyndonWordsExact(d, k)[rem];
      const rep = n / d;
      const out: number[] = [];
      for (let i = 0; i < rep; i++) for (const x of L) out.push(x);
      return out;
    }
    rem -= block;
  }
  return []; // unreachable when 0 <= rem < total
}

function necklacesRank(e: any, p: number[]): number {
  const n = p[0];
  const k = p[1];
  if (n <= 0) return 0;
  const w = e as number[];
  const divs = divisorsOf(n);
  let d = n;
  for (const cand of divs) {
    if (isPeriod(w, cand)) {
      d = cand;
      break;
    }
  }
  const L = w.slice(0, d);
  const idx = lyndonWordsExact(d, k).findIndex((x) => arraysEqual(x, L));
  let offset = 0;
  for (const dd of divs) {
    if (dd === d) break;
    offset += lyndonCount(dd, k);
  }
  return offset + idx;
}

function necklacesValid(e: any, p: number[]): boolean {
  const n = p[0];
  const k = p[1];
  if (!Array.isArray(e) || e.length !== n) return false;
  for (const v of e) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > k) return false;
  }
  if (n === 0) return true;
  for (let s = 1; s < n; s++) {
    if (compareArrays(e, rotateLeft(e, s)) > 0) return false; // e must be <= every rotation
  }
  return true;
}

// ─── LyndonWords(n,k): aperiodic necklaces — words strictly smaller than every one of their
// nontrivial rotations. count(n,k) = (1/n) Σ_{d|n} μ(d)·k^(n/d). unrank/rank index directly into
// the FKM lex-order listing of length-exactly-n Lyndon words. ──────────────────────────────────────

function lyndonWordsCount(p: number[]): number {
  return lyndonCount(p[0], p[1]);
}

function lyndonWordsUnrank(p: number[], r: number): number[] {
  const n = p[0];
  const k = p[1];
  if (n <= 0) return [];
  const total = lyndonWordsCount(p);
  const idx = normRank(r, total);
  return lyndonWordsExact(n, k)[idx];
}

function lyndonWordsRank(e: any, p: number[]): number {
  const n = p[0];
  const k = p[1];
  const w = e as number[];
  return lyndonWordsExact(n, k).findIndex((x) => arraysEqual(x, w));
}

function lyndonWordsValid(e: any, p: number[]): boolean {
  const n = p[0];
  const k = p[1];
  if (!Array.isArray(e) || e.length !== n) return false;
  for (const v of e) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > k) return false;
  }
  if (n === 0) return false; // no length-0 Lyndon word
  for (let s = 1; s < n; s++) {
    if (compareArrays(e, rotateLeft(e, s)) >= 0) return false; // strictly < every nontrivial rotation
  }
  return true;
}

// ─── Groupings(n): the ways to parenthesize n ordered items 1..n with a binary operator (Wolfram
// Groupings[n, 2]). Count = Catalan(n-1). Element is a nested binary structure: a leaf is its label
// 1..n (left-to-right), a node is [left, right]. E.g. Groupings(3) = { [[1,2],3], [1,[2,3]] }. ────

type G = number | G[];

function groupingsBuild(leaves: number[], r: number): G {
  const m = leaves.length;
  if (m === 1) return leaves[0];
  let rem = r;
  for (let i = 1; i < m; i++) {
    const rc = CatalanNumber(m - i - 1);
    const block = CatalanNumber(i - 1) * rc;
    if (rem < block) {
      return [groupingsBuild(leaves.slice(0, i), Math.floor(rem / rc)), groupingsBuild(leaves.slice(i), rem % rc)];
    }
    rem -= block;
  }
  return leaves[0]; // unreachable
}

function groupingsRankRec(t: G): { r: number; m: number } {
  if (!Array.isArray(t)) return { r: 0, m: 1 };
  const [L, R] = t;
  const { r: lr, m: lm } = groupingsRankRec(L);
  const { r: rr, m: rm } = groupingsRankRec(R);
  const m = lm + rm;
  let base = 0;
  for (let k = 1; k < lm; k++) base += CatalanNumber(k - 1) * CatalanNumber(m - k - 1);
  const rc = CatalanNumber(m - lm - 1);
  return { r: base + lr * rc + rr, m };
}

function groupingsCollectLeaves(t: G, out: number[]): boolean {
  if (!Array.isArray(t)) { if (!Number.isInteger(t)) return false; out.push(t); return true; }
  if (t.length !== 2) return false; // a binary node has exactly two children
  return groupingsCollectLeaves(t[0], out) && groupingsCollectLeaves(t[1], out);
}

// ─── RevolvingDoorKSubsets(n,k): the k-subsets of {1,...,n} in revolving-door (Gray-code) order:
// consecutive subsets differ by removing one element and adding one (symmetric difference of size
// 2). Elements are 1-indexed ascending, matching the public representation directly (no internal
// shift needed).
//
// Direct closed-form rank/unrank (Kreher & Stinson, "Combinatorial Algorithms", CRC Press 1998 —
// ksubset_revdoor_rank/ksubset_revdoor_unrank, the standard reference implementation for this
// ordering; ported here from the FORTRAN source): unrank walks positions i = k..1 (largest element
// first): find the largest x with C(x,i) <= remaining rank, set t[i] = x+1, and update the remaining
// rank to C(x+1,i) - rank - 1 (this "reflects" the rank the way a Gray-code odometer carries, which
// is what produces the single-swap adjacency instead of plain combinadic/lexicographic order). rank
// is the alternating-sign inverse: rank = (k even ? 0 : -1) + sum_{i=k..1} (-1)^{k-i} * C(t[i], i). ──

function binom(n: number, k: number): number {
  if (n < 0 || k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < kk; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
}

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
    head: "BalancedBinaryStrings",
    paramCount: 1,
    kind: "ints",
    count: balancedBinaryStringsCount,
    unrank: balancedBinaryStringsUnrank,
    rank: balancedBinaryStringsRank,
    valid: balancedBinaryStringsValid,
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
  {
    head: "BinaryStringsAvoiding111",
    paramCount: 1,
    kind: "ints",
    count: binAvoid111Count,
    unrank: binAvoid111Unrank,
    rank: binAvoid111Rank,
    valid: binAvoid111Valid,
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
  {
    head: "BinaryStringsAvoiding010",
    paramCount: 1,
    kind: "ints",
    count: binaryStringsAvoiding010Count,
    unrank: binaryStringsAvoiding010Unrank,
    rank: binaryStringsAvoiding010Rank,
    valid: binaryStringsAvoiding010Valid,
  },
  {
    head: "BinaryStringsAvoiding101",
    paramCount: 1,
    kind: "ints",
    count: binaryStringsAvoiding101Count,
    unrank: binaryStringsAvoiding101Unrank,
    rank: binaryStringsAvoiding101Rank,
    valid: binaryStringsAvoiding101Valid,
  },
  {
    head: "BinaryStringsAvoiding0101",
    paramCount: 1,
    kind: "ints",
    count: binaryStringsAvoiding0101Count,
    unrank: binaryStringsAvoiding0101Unrank,
    rank: binaryStringsAvoiding0101Rank,
    valid: binaryStringsAvoiding0101Valid,
  },
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
    head: "Necklaces",
    paramCount: 2,
    kind: "ints",
    count: necklacesCount,
    unrank: necklacesUnrank,
    rank: necklacesRank,
    valid: necklacesValid,
  },
  {
    head: "LyndonWords",
    paramCount: 2,
    kind: "ints",
    count: lyndonWordsCount,
    unrank: lyndonWordsUnrank,
    rank: lyndonWordsRank,
    valid: lyndonWordsValid,
  },
  {
    head: "Groupings",
    paramCount: 1,
    kind: "nested",
    count: ([n]) => (n < 1 ? 0 : CatalanNumber(n - 1)),
    unrank: ([n], r) => groupingsBuild(Array.from({ length: n }, (_, i) => i + 1), r),
    rank: (e) => groupingsRankRec(e as G).r,
    valid: (e, [n]) => {
      const leaves: number[] = [];
      if (!groupingsCollectLeaves(e as G, leaves)) return false;
      if (leaves.length !== n) return false;
      for (let i = 0; i < n; i++) if (leaves[i] !== i + 1) return false; // labels 1..n, in order
      return true;
    },
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
