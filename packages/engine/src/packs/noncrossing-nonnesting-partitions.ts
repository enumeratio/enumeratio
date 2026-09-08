// pack-b.ts — pure-TS rank/unrank kernels for two Catalan-counted set-partition families:
// NonCrossingPartitions(n) and NonNestingPartitions(n). Self-contained: no imports, no I/O,
// plain JS numbers/arrays. See .scratch/pack-b-selfcert.mts for the exhaustive
// rank(unrank(p,r),p)===r certification over n=0..9, plus an independent brute-force
// count cross-check and explicit crossing/nesting rejection tests.
//
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
// f(t,a) = f(t-1,a+1) + sum_{m=1}^{a} f(t-1,m), f(0,a)=1, with f(n,0) = Catalan(n) — verified by
// hand for n=2,3,4 against the standard Catalan recurrence, and by the exhaustive self-cert.
//
// Crossing/nesting are both judged via each block's CONSECUTIVE-element arcs (block {x1<x2<...}
// contributes arcs (x1,x2),(x2,x3),...) — the standard arc-diagram reading, and the one under
// which "non-nesting" is Catalan-counted (confirmed against a brute-force enumeration over all
// set partitions for n<=6 in the self-cert; the literal ALL-PAIRS reading of "a,d in one block"
// — not just consecutive elements — is strictly more restrictive for nesting and is NOT
// Catalan-counted past n=4, so it is deliberately not used here). For crossing, the two readings
// coincide (also confirmed by the same brute-force check), so hasCrossing checks all pairs directly.

import type { PackEntry } from "./types.js";

// ---- Catalan numbers ---------------------------------------------------------------------

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

// ---- entries ------------------------------------------------------------------------------

export const entries: PackEntry[] = [
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
];
