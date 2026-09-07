// pack-v.ts — pure-TS rank/unrank kernels for two combinatorial collections:
// SetPartitionsIntoAtMostKBlocks(n,k) and BinaryStringsAvoiding010(n). Self-contained: no
// imports, no I/O, plain JS numbers/arrays. See .scratch/pack-v-selfcert.mts for the
// exhaustive rank(unrank(p,r),p)===r certification, an independent Stirling-second-kind
// cross-check of count() for the set-partition family, and a brute-force
// (generate-all-length-n-bitstrings-and-filter) cross-check of count()/valid() for the
// no-010 family (n<=12), plus the given n=3 -> 7 sanity value.

export type PackEntry = {
  head: string; // PascalCase MathJSON head, e.g. "SetPartitionsIntoAtMostKBlocks"
  paramCount: 1 | 2; // number of integer parameters
  kind: "ints" | "blocks"; // element shape: flat int list, OR a list of int lists
  count: (p: number[]) => number; // p = [n] or [n,k]; closed recurrence
  unrank: (p: number[], r: number) => number[] | number[][]; // 0-based
  rank: (e: any, p: number[]) => number; // exact 0-based inverse of unrank
  valid: (e: any, p: number[]) => boolean; // is e a member of this collection at params p
};

const normRank = (r: number, total: number): number =>
  total > 0 ? (((Math.trunc(r) % total) + total) % total) : 0;

// ─── SetPartitionsIntoAtMostKBlocks(n,k): partitions of {1,...,n} using AT MOST k blocks,
// counted by sum_{j=0..k} StirlingSecond(n,j). Elements are represented the same way as an
// unrestricted set partition (a list of blocks, each sorted ascending, blocks themselves
// ordered by least element) via an RGS-style word w[0..n-1] with w[0]=0 and w[i] the index
// (in first-appearance order) of element i+1's block. This is EXACTLY the RestrictedGrowthStrings
// process (see pack-u.ts) with one extra constraint: the running max block index m must never
// exceed k-1 (i.e. total blocks used must never exceed k), so the "open a brand-new block" move
// is only legal while m <= k-2. f(t,m) = valid completions of a length-t suffix given running
// max m going in: f(0,m)=1, f(t,m) = (m+1)*f(t-1,m) + [m<=k-2]*f(t-1,m+1) — identical to the
// unrestricted RGS recurrence except the "extend" term is dropped once m hits the cap k-1.
// count(n,k) = f(n-1,0) for n>=1 (n=0 is the trivial empty partition, valid for any k>=0).
// unrank/rank walk the same branch order as the unrestricted RGS kernel (reuse v=0..m in order,
// each an f(t,m)-sized block, then — if still under the cap — the single "extend" choice). ────

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

// ─── BinaryStringsAvoiding010(n): length-n strings over {0,1} with no occurrence of the factor
// "010", counted by g(n,0) below (1,2,4,7,13,24,44,81,... — n=3 gives 7 = 2^3 - 1, the single
// excluded string "010"). DP over the KMP-automaton state for pattern "010": state 0 = no
// relevant match in progress (or empty prefix), state 1 = trailing suffix matches "0", state 2 =
// trailing suffix matches "01"; reading a bit that would complete "010" (bit 0 from state 2) is
// the ONE forbidden transition. g(t,s) = valid completions of t remaining positions from state s:
// g(0,s)=1; g(t,0)=g(t-1,1)+g(t-1,0) (bit0->1, bit1->0); g(t,1)=g(t-1,1)+g(t-1,2) (bit0->1,
// bit1->2); g(t,2)=g(t-1,0) (bit0 is the forbidden completion, excluded; bit1->0). count(n) =
// g(n,0). unrank tries bit 0 then bit 1 at each position (skipping a dead transition entirely),
// counting completions that still avoid "010"; rank replays the identical walk. ────────────────

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

// -----------------------------------------------------------------------------

export const entries: PackEntry[] = [
  {
    head: "SetPartitionsIntoAtMostKBlocks",
    paramCount: 2,
    kind: "blocks",
    count: setPartitionsAtMostKCount,
    unrank: setPartitionsAtMostKUnrank,
    rank: setPartitionsAtMostKRank,
    valid: setPartitionsAtMostKValid,
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
];
