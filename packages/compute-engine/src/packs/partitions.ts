// Partitions — integer partitions (bounded-part-count, odd parts, self-conjugate) and set
// partitions (non-crossing, non-nesting, no-singletons, at-most-k-blocks). Pure-TS rank/unrank
// kernels: no I/O, plain JS numbers/arrays. Consolidated from five parallel-authored packs; every
// kernel's rank(unrank(p,r),p)===r certification lives in test/selfcert.test.ts.

import type { PackEntry } from "./types.js";

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ---- PartitionsIntoAtMostKParts(n,k) ---------------------------------------
// Weakly-decreasing integer partitions of n with at most k parts. State
// c(n,k,m) = # partitions of n into at most k parts, each part <= m:
//   c(0,*,*) = 1
//   c(n,0,*) = c(n,*,0) = 0   for n>0
//   c(n,k,m) = sum_{v=1}^{min(n,m)} c(n-v, k-1, v)   (choose the largest
//     remaining part v first, then recurse with one fewer part slot and a
//     new cap of v so the result stays weakly decreasing)
// Top-level call uses m=n (a single part can be at most n). unrank/rank walk
// v=1..min(n,m) in the same order as the sum, so they are exact inverses.

function countAtMostK(n: number, k: number, m: number, memo: Map<string, number>): number {
  if (n === 0) return 1;
  if (k === 0 || m === 0) return 0;
  const key = n + "," + k + "," + m;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const cap = Math.min(n, m);
  let total = 0;
  for (let v = 1; v <= cap; v++) total += countAtMostK(n - v, k - 1, v, memo);
  memo.set(key, total);
  return total;
}

function partitionsAtMostKCount(p: number[]): number {
  const [n, k] = p;
  return countAtMostK(n, k, n, new Map());
}

function partitionsAtMostKUnrank(p: number[], r: number): number[] {
  const [n, k] = p;
  const memo = new Map<string, number>();
  let rem = n;
  let curK = k;
  let curM = n;
  let rr = r;
  const parts: number[] = [];
  while (rem > 0) {
    const cap = Math.min(rem, curM);
    let chosen = -1;
    for (let v = 1; v <= cap; v++) {
      const c = countAtMostK(rem - v, curK - 1, v, memo);
      if (rr < c) {
        chosen = v;
        break;
      }
      rr -= c;
    }
    parts.push(chosen);
    rem -= chosen;
    curK -= 1;
    curM = chosen;
  }
  return parts;
}

function partitionsAtMostKRank(e: number[], p: number[]): number {
  const [n, k] = p;
  const memo = new Map<string, number>();
  let rem = n;
  let curK = k;
  let curM = n;
  let rank = 0;
  for (const part of e) {
    for (let v = 1; v < part; v++) rank += countAtMostK(rem - v, curK - 1, v, memo);
    rem -= part;
    curK -= 1;
    curM = part;
  }
  return rank;
}

function partitionsAtMostKValid(e: any, p: number[]): boolean {
  const [n, k] = p;
  if (!Array.isArray(e)) return false;
  if (e.length > k) return false;
  let sum = 0;
  for (let i = 0; i < e.length; i++) {
    const v = e[i];
    if (!Number.isInteger(v) || v < 1) return false;
    if (i > 0 && v > e[i - 1]) return false; // weakly decreasing
    sum += v;
  }
  return sum === n;
}

// ---- shared helper (odd-part partitions below) -----------------------------

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

// ---- NonCrossingPartitions(n) / NonNestingPartitions(n) --------------------
// Both families are built from ONE shared process: walk elements 1..n, at each step either
// open a brand-new block (its first/least element), or EXTEND one of the currently-open block
// "tails" (a tail = a block's current last element, waiting for a possible successor). If a
// elements are open (sorted ascending v_1<...<v_a) and you extend v_j (1-indexed), the other
// open tails split into "smaller than v_j" and "larger than v_j":
//   - stack rule (non-crossing): extending v_j forces every LARGER open tail to freeze forever
//     (touching one later would cross the arc you just drew) — survivors are v_1..v_{j-1}.
//   - queue rule (non-nesting): extending v_j forces every SMALLER open tail to freeze forever
//     (touching one later would nest inside the arc you just drew) — survivors are v_{j+1}..v_a.
// Either way exactly j-1 (stack) or a-j (queue) old tails survive, plus the new tail (the
// element just placed) — the counting recursion for "ways to finish with a open tails and t
// steps left" is IDENTICAL for both rules (only WHICH slice survives differs), and it satisfies
// f(t,a) = f(t-1,a+1) + sum_{m=1}^{a} f(t-1,m), f(0,a)=1, with f(n,0) = Catalan(n).
//
// Crossing/nesting are both judged via each block's CONSECUTIVE-element arcs (block {x1<x2<...}
// contributes arcs (x1,x2),(x2,x3),...) — the standard arc-diagram reading, and the one under
// which "non-nesting" is Catalan-counted (the literal ALL-PAIRS reading of "a,d in one block" —
// not just consecutive elements — is strictly more restrictive for nesting and is NOT
// Catalan-counted past n=4, so it is deliberately not used here). For crossing, the two readings
// coincide, so hasCrossing checks all pairs directly.

function catalanArray(maxN: number): number[] {
  const cat = new Array(maxN + 1).fill(0);
  cat[0] = 1;
  for (let i = 1; i <= maxN; i++) {
    let s = 0;
    for (let k = 0; k < i; k++) s += cat[k] * cat[i - 1 - k];
    cat[i] = s;
  }
  return cat;
}

function catalan(n: number): number {
  return catalanArray(n)[n];
}

// ---- shared level table: f[t][a] = ways to finish with `t` elements left and `a` open tails ----

function buildLevelTable(n: number): number[][] {
  const maxA = n + 1;
  const f: number[][] = Array.from({ length: n + 1 }, () => new Array(maxA + 1).fill(0));
  for (let a = 0; a <= maxA; a++) f[0][a] = 1;
  for (let t = 1; t <= n; t++) {
    const prev = f[t - 1];
    // prefix[a] = sum_{m=1}^{a} prev[m]
    const prefix = new Array(maxA + 1).fill(0);
    for (let a = 1; a <= maxA; a++) prefix[a] = prefix[a - 1] + prev[a];
    for (let a = 0; a <= maxA; a++) f[t][a] = (a + 1 <= maxA ? prev[a + 1] : 0) + prefix[a];
  }
  return f;
}

type Mode = "stack" | "queue"; // stack -> non-crossing, queue -> non-nesting

/** Weight of "extend the j-th-smallest (1-indexed) of `a` open tails" at level `t-1`. */
function extendWeight(f: number[][], t: number, a: number, j: number, mode: Mode): number {
  return mode === "stack" ? f[t - 1][j] : f[t - 1][a - j + 1];
}

/** Which open tails (0-indexed slice of the ascending-sorted `available` array) survive extending index j-1. */
function survivorsOf<T>(available: T[], j: number, mode: Mode): T[] {
  return mode === "stack" ? available.slice(0, j - 1) : available.slice(j);
}

// ---- generic unrank / rank over the tail process -----------------------------------------

function unrankPartitionProcess(n: number, r: number, mode: Mode): number[][] {
  if (n === 0) return [];
  const f = buildLevelTable(n);
  let available: { value: number; blockId: number }[] = [];
  const blocks: number[][] = [];
  for (let i = 1; i <= n; i++) {
    const a = available.length;
    const t = n - i + 1;
    const oSize = f[t - 1][a + 1];
    if (r < oSize) {
      const blockId = blocks.length;
      blocks.push([i]);
      available = [...available, { value: i, blockId }];
      continue;
    }
    r -= oSize;
    let j = 1;
    while (true) {
      const size = extendWeight(f, t, a, j, mode);
      if (r < size) break;
      r -= size;
      j++;
    }
    const chosen = available[j - 1];
    blocks[chosen.blockId].push(i);
    available = [...survivorsOf(available, j, mode), { value: i, blockId: chosen.blockId }];
  }
  return blocks;
}

function rankPartitionProcess(e: any, n: number, mode: Mode): number {
  const blocks: number[][] = (e as number[][]).map((b) => [...b].sort((x, y) => x - y));
  const blockIndexOf = new Array(n + 1).fill(-1);
  blocks.forEach((b, bi) => b.forEach((x) => (blockIndexOf[x] = bi)));
  const predOf = new Array(n + 1).fill(0); // predOf[x] = element right before x in its block, or 0 if x is the block minimum
  blocks.forEach((b) => {
    for (let k = 1; k < b.length; k++) predOf[b[k]] = b[k - 1];
  });
  const f = buildLevelTable(n);
  let available: { value: number; blockId: number }[] = [];
  let rank = 0;
  for (let i = 1; i <= n; i++) {
    const a = available.length;
    const t = n - i + 1;
    const bi = blockIndexOf[i];
    if (predOf[i] === 0) {
      available = [...available, { value: i, blockId: bi }];
      continue; // choice "open new block" is always ordered first — contributes 0 to rank
    }
    const p = predOf[i];
    const idx = available.findIndex((en) => en.value === p);
    const j = idx + 1;
    rank += f[t - 1][a + 1]; // the O-branch precedes every extend-branch
    for (let jj = 1; jj < j; jj++) rank += extendWeight(f, t, a, jj, mode);
    available = [...survivorsOf(available, j, mode), { value: i, blockId: bi }];
  }
  return rank;
}

// ---- structural validity (order-insensitive; canonicalizes blocks before checking) --------

function canonicalBlocks(e: any): number[][] | undefined {
  if (!Array.isArray(e)) return undefined;
  const out: number[][] = [];
  for (const b of e) {
    if (!Array.isArray(b)) return undefined;
    out.push([...b].sort((x, y) => x - y));
  }
  return out;
}

function isValidSetPartition(blocks: number[][], n: number): boolean {
  const seen = new Array(n + 1).fill(false);
  let total = 0;
  for (const blk of blocks) {
    if (blk.length === 0) return false;
    for (const x of blk) {
      if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
      seen[x] = true;
      total++;
    }
  }
  return total === n;
}

function blockOfArray(blocks: number[][], n: number): number[] {
  const blockOf = new Array(n + 1).fill(-1);
  blocks.forEach((blk, bi) => blk.forEach((x) => (blockOf[x] = bi)));
  return blockOf;
}

/** No a<b<c<d with a,c in one block and b,d in another (their arcs interleave) — all-pairs and
 * consecutive-arc readings coincide for crossing, so this checks every pair directly. */
function hasCrossing(blockOf: number[], n: number): boolean {
  for (let a = 1; a <= n; a++)
    for (let b = a + 1; b <= n; b++)
      for (let c = b + 1; c <= n; c++)
        for (let d = c + 1; d <= n; d++)
          if (blockOf[a] === blockOf[c] && blockOf[b] === blockOf[d] && blockOf[a] !== blockOf[b]) return true;
  return false;
}

/** No consecutive-in-block arc (x_k,x_{k+1}) properly containing a consecutive-in-block arc from a
 * different block: i1<j1<j2<i2. This is the standard arc-diagram nesting reading (see file header). */
function hasNesting(blocks: number[][]): boolean {
  const arcs: [number, number][] = [];
  for (const blk of blocks) for (let k = 1; k < blk.length; k++) arcs.push([blk[k - 1], blk[k]]);
  for (let i = 0; i < arcs.length; i++)
    for (let j = 0; j < arcs.length; j++) {
      if (i === j) continue;
      const [i1, i2] = arcs[i];
      const [j1, j2] = arcs[j];
      if (i1 < j1 && j2 < i2) return true; // arc j nests strictly inside arc i
    }
  return false;
}

// ---- SetPartitionsNoSingletons(n) ------------------------------------------
// Partitions of [n] with no block of size 1. Count = associated Bell numbers (OEIS A000296:
// 1,0,1,1,4,11,41,162,...). Unrank via an RGS-style DP over state (m, s) = (max label used so
// far, count of currently-singleton blocks among the m+1 open blocks); a completion is only
// valid once every block has grown past size 1.

const _noSingletonMemo = new Map<string, number>();
// #ways to extend an RGS suffix of length `remaining`, given m+1 blocks open with s still singleton, such
// that no block is left singleton once the suffix is exhausted.
function noSingletonCompletions(remaining: number, m: number, s: number): number {
  if (remaining === 0) return s === 0 ? 1 : 0;
  const key = `${remaining},${m},${s}`;
  const cached = _noSingletonMemo.get(key);
  if (cached !== undefined) return cached;
  let v = 0;
  if (s > 0) v += s * noSingletonCompletions(remaining - 1, m, s - 1); // grow one of the s singleton blocks
  const nonSingleton = m + 1 - s;
  if (nonSingleton > 0) v += nonSingleton * noSingletonCompletions(remaining - 1, m, s); // grow a settled block
  v += noSingletonCompletions(remaining - 1, m + 1, s + 1); // open a new (singleton) block
  _noSingletonMemo.set(key, v);
  return v;
}

function SetPartitionsNoSingletonsCount(n: number): number {
  if (n < 0) return 0;
  return noSingletonCompletions(n, -1, 0);
}

// RGS (0-based labels, first-appearance order) -> blocks; label order == least-element order for free.
function rgsToBlocksNS(w: number[]): number[][] {
  const blocks: number[][] = [];
  w.forEach((b, i) => { (blocks[b] ??= []).push(i + 1); });
  return blocks;
}
function blocksToRgsNS(blocks: number[][], n: number): number[] {
  const ordered = blocks
    .map((b) => [...b].sort((a, z) => a - z))
    .filter((b) => b.length > 0)
    .sort((a, b) => a[0] - b[0]);
  const w = new Array(n).fill(-1);
  ordered.forEach((blk, bi) => blk.forEach((x) => { w[x - 1] = bi; }));
  return w;
}

function SetPartitionsNoSingletonsUnrank(n: number, rank: number): number[][] {
  const total = SetPartitionsNoSingletonsCount(n);
  let r = normRank(rank, total);
  const w: number[] = [];
  const blockSize: number[] = [];
  let m = -1, s = 0;
  for (let i = 0; i < n; i++) {
    const remainingAfter = n - i - 1;
    let chosen = -1, newm = m, news = s;
    for (let cand = 0; cand <= m + 1; cand++) {
      const isNew = cand > m;
      const nm = isNew ? m + 1 : m;
      const ns = isNew ? s + 1 : (blockSize[cand] === 1 ? s - 1 : s);
      const cnt = noSingletonCompletions(remainingAfter, nm, ns);
      if (r < cnt) { chosen = cand; newm = nm; news = ns; break; }
      r -= cnt;
    }
    w.push(chosen);
    blockSize[chosen] = (blockSize[chosen] ?? 0) + 1;
    m = newm; s = news;
  }
  return rgsToBlocksNS(w);
}

function SetPartitionsNoSingletonsRank(blocks: number[][], n: number): number {
  const w = blocksToRgsNS(blocks, n);
  let r = 0;
  const blockSize: number[] = [];
  let m = -1, s = 0;
  for (let i = 0; i < n; i++) {
    const remainingAfter = n - i - 1;
    const actual = w[i];
    // every candidate below `actual` is an existing block (actual <= m+1, so cand < actual implies cand <= m)
    for (let cand = 0; cand < actual; cand++) {
      const ns = blockSize[cand] === 1 ? s - 1 : s;
      r += noSingletonCompletions(remainingAfter, m, ns);
    }
    const isNew = actual > m;
    const wasSingleton = !isNew && blockSize[actual] === 1;
    blockSize[actual] = (blockSize[actual] ?? 0) + 1;
    if (isNew) { m += 1; s += 1; } else if (wasSingleton) { s -= 1; }
  }
  return r;
}

function IsSetPartitionNoSingletons(blocks: unknown, n: number): boolean {
  if (!Array.isArray(blocks)) return false;
  const seen = new Array(n + 1).fill(false);
  let total = 0;
  for (const blk of blocks) {
    if (!Array.isArray(blk) || blk.length < 2) return false; // no empty AND no singleton blocks
    for (const x of blk) {
      if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
      seen[x] = true;
      total++;
    }
  }
  return total === n;
}

// ---- SetPartitionsIntoAtMostKBlocks(n,k) -----------------------------------
// Partitions of {1,...,n} using AT MOST k blocks, counted by sum_{j=0..k} StirlingSecond(n,j).
// Elements are represented the same way as an unrestricted set partition (a list of blocks, each
// sorted ascending, blocks themselves ordered by least element) via an RGS-style word w[0..n-1]
// with w[0]=0 and w[i] the index (in first-appearance order) of element i+1's block. This is
// EXACTLY the RestrictedGrowthStrings process with one extra constraint: the running max block
// index m must never exceed k-1 (i.e. total blocks used must never exceed k), so the "open a
// brand-new block" move is only legal while m <= k-2. f(t,m) = valid completions of a length-t
// suffix given running max m going in: f(0,m)=1, f(t,m) = (m+1)*f(t-1,m) + [m<=k-2]*f(t-1,m+1) —
// identical to the unrestricted RGS recurrence except the "extend" term is dropped once m hits
// the cap k-1. count(n,k) = f(n-1,0) for n>=1 (n=0 is the trivial empty partition, valid for any
// k>=0). unrank/rank walk the same branch order as the unrestricted RGS kernel.

function boundedBlocksTable(n: number, kMax: number): number[][] {
  // f[t][m], t=0..n (remaining suffix length), m=0..kMax-1 (current max block index, i.e. m+1
  // blocks used so far). Requires kMax >= 1 (callers guard the kMax<=0 case separately).
  const f: number[][] = [];
  for (let t = 0; t <= n; t++) f.push(new Array(kMax).fill(0));
  for (let m = 0; m < kMax; m++) f[0][m] = 1; // no positions left: exactly one completion
  for (let t = 1; t <= n; t++) {
    for (let m = 0; m < kMax; m++) {
      const extend = m + 1 < kMax ? f[t - 1][m + 1] : 0; // opening a new block is illegal at the cap
      f[t][m] = (m + 1) * f[t - 1][m] + extend;
    }
  }
  return f;
}

function setPartitionsAtMostKCount(p: number[]): number {
  const n = p[0];
  const kMax = p[1];
  if (n < 0) return 0;
  if (n === 0) return 1; // the empty partition: 0 blocks, valid for any k>=0
  if (kMax <= 0) return 0; // n>=1 elements always need at least 1 block
  return boundedBlocksTable(n, kMax)[n - 1][0];
}

function setPartitionsAtMostKUnrank(p: number[], r: number): number[][] {
  const n = p[0];
  const kMax = p[1];
  if (n <= 0) return [];
  const f = boundedBlocksTable(n, Math.max(kMax, 1));
  const total = f[n - 1][0];
  let rem = normRank(r, total);
  const w = [0];
  let m = 0;
  for (let i = 1; i < n; i++) {
    const t = n - 1 - i; // suffix length remaining after this position
    let chosen = -1;
    for (let v = 0; v <= m; v++) {
      const block = f[t][m];
      if (rem < block) { chosen = v; break; }
      rem -= block;
    }
    if (chosen === -1) {
      chosen = m + 1; // the single "open a new block" choice (only reached when still under the cap)
      m = chosen;
    }
    w.push(chosen);
  }
  const blocks: number[][] = [];
  for (let i = 0; i < n; i++) {
    const bi = w[i];
    if (!blocks[bi]) blocks[bi] = [];
    blocks[bi].push(i + 1);
  }
  return blocks;
}

/** Sorts each block ascending and orders the blocks by least element (the canonical RGS shape);
 * returns undefined if `e` isn't shaped like a list of non-empty integer blocks. */
function canonicalPartitionBlocks(e: any): number[][] | undefined {
  if (!Array.isArray(e)) return undefined;
  const out: number[][] = [];
  for (const b of e) {
    if (!Array.isArray(b) || b.length === 0) return undefined;
    out.push([...b].sort((x, y) => x - y));
  }
  out.sort((a, b) => a[0] - b[0]);
  return out;
}

function setPartitionsAtMostKRank(e: any, p: number[]): number {
  const n = p[0];
  const kMax = p[1];
  if (n <= 0) return 0;
  const blocks = canonicalPartitionBlocks(e);
  if (!blocks) return 0;
  const blockOf = new Array(n + 1).fill(-1);
  blocks.forEach((blk, bi) => blk.forEach((x) => { blockOf[x] = bi; }));
  const f = boundedBlocksTable(n, Math.max(kMax, 1));
  let rank = 0;
  let m = 0;
  for (let i = 1; i < n; i++) {
    const t = n - 1 - i;
    const v = blockOf[i + 1];
    if (v <= m) {
      rank += v * f[t][m];
    } else {
      rank += (m + 1) * f[t][m];
      m = v; // v === m+1 for a valid at-most-k-blocks partition
    }
  }
  return rank;
}

function setPartitionsAtMostKValid(e: any, p: number[]): boolean {
  const n = p[0];
  const kMax = p[1];
  const blocks = canonicalPartitionBlocks(e);
  if (!blocks) return false;
  const seen = new Array(n + 1).fill(false);
  let total = 0;
  for (const blk of blocks) {
    for (const x of blk) {
      if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
      seen[x] = true;
      total++;
    }
  }
  if (total !== n) return false;
  return blocks.length <= kMax;
}

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "PartitionsIntoAtMostKParts",
    paramCount: 2,
    kind: "ints",
    count: partitionsAtMostKCount,
    unrank: partitionsAtMostKUnrank,
    rank: partitionsAtMostKRank,
    valid: partitionsAtMostKValid,
  },
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
  {
    head: "NonCrossingPartitions",
    paramCount: 1,
    kind: "blocks",
    count: (p) => catalan(p[0]),
    unrank: (p, r) => unrankPartitionProcess(p[0], r, "stack"),
    rank: (e, p) => rankPartitionProcess(e, p[0], "stack"),
    valid: (e, p) => {
      const blocks = canonicalBlocks(e);
      if (!blocks || !isValidSetPartition(blocks, p[0])) return false;
      return !hasCrossing(blockOfArray(blocks, p[0]), p[0]);
    },
  },
  {
    head: "NonNestingPartitions",
    paramCount: 1,
    kind: "blocks",
    count: (p) => catalan(p[0]),
    unrank: (p, r) => unrankPartitionProcess(p[0], r, "queue"),
    rank: (e, p) => rankPartitionProcess(e, p[0], "queue"),
    valid: (e, p) => {
      const blocks = canonicalBlocks(e);
      if (!blocks || !isValidSetPartition(blocks, p[0])) return false;
      return !hasNesting(blocks);
    },
  },
  {
    head: "SetPartitionsNoSingletons",
    paramCount: 1,
    kind: "blocks",
    count: (p) => SetPartitionsNoSingletonsCount(p[0]),
    unrank: (p, r) => SetPartitionsNoSingletonsUnrank(p[0], r),
    rank: (e, p) => SetPartitionsNoSingletonsRank(e as number[][], p[0]),
    valid: (e, p) => IsSetPartitionNoSingletons(e, p[0]),
  },
  {
    head: "SetPartitionsIntoAtMostKBlocks",
    paramCount: 2,
    kind: "blocks",
    count: setPartitionsAtMostKCount,
    unrank: setPartitionsAtMostKUnrank,
    rank: setPartitionsAtMostKRank,
    valid: setPartitionsAtMostKValid,
  },
];
