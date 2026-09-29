// Lattice-path variants. Pure rank/unrank kernels over plain JS numbers/arrays (no
// compute-engine dependency) — same contract as every other family: rank(unrank(p, r), p) ===
// r, valid(unrank(p, r), p) === true for all r in [0, count(p)). Kept in its own file
// (registered via install.ts) so parallel roadmap batches don't collide with core.ts.
//
// RestrictedGrowthStrings and NonCrossingPartitions/NonNestingPartitions/NonCrossingMatchings/
// NonNestingMatchings moved to set-partitions/src/families/{paths-partitions,matchings}.ts --
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5. The latter four now carry
// "SetPartition" (their "blocks" shape matches it exactly).
import type { NumberKernel } from "./types.ts";
import {
  CatalanNumber,
  DyckPathCount,
  DyckPathRank,
  DyckPathUnrank,
  IsDyckPath,
  KSubsetCount,
  KSubsetRank,
  KSubsetUnrank,
  OrderedTreeRank,
  OrderedTreeUnrank,
  type OrdTree,
} from "./kernels-extra.ts";

// ─── GrandDyckPaths(n): free ±1-step paths of length 2n over up(1)/down(0), starting and ending at
// height 0, with NO non-negativity constraint. Count = C(2n,n): choose which n of the 2n
// positions are up-steps — a direct wrapper over KSubset{Count,Unrank,Rank} from kernels-extra.ts.
// Steps encoded 1=up/0=down, matching the DyckPaths convention (just without the height floor). ──
function isGrandDyckPathOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== 2 * n) return false;
  let ones = 0;
  for (const s of e) {
    if (s !== 0 && s !== 1) return false;
    if (s === 1) ones++;
  }
  return ones === n;
}

// ─── DelannoyPaths(n): lattice paths from (0,0) to (n,n) using East=(1,0), North=(0,1), and
// Diagonal=(1,1) steps — encoded as a token sequence over {0=E,1=N,2=D} whose length varies (n for
// an all-diagonal path, up to 2n for an all-E/N path). f[i][j] = # completions from (i,j) to
// (n,n): f(n,n)=1, f(i,j) = f(i+1,j) [E] + f(i,j+1) [N] + f(i+1,j+1) [D] (each only when the
// target stays in range). count(n) = f(0,0), the central Delannoy numbers (1,3,13,63,321,...).
// unrank/rank walk from (0,0) toward (n,n), trying E, then N, then D at each step. ───────────────
const _delannoyMemo = new Map<number, number[][]>();
function delannoyTable(n: number): number[][] {
  const cached = _delannoyMemo.get(n);
  if (cached) return cached;
  const f: number[][] = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
  f[n][n] = 1;
  for (let i = n; i >= 0; i--) {
    for (let j = n; j >= 0; j--) {
      if (i === n && j === n) continue;
      const e = i + 1 <= n ? f[i + 1][j] : 0;
      const north = j + 1 <= n ? f[i][j + 1] : 0;
      const d = i + 1 <= n && j + 1 <= n ? f[i + 1][j + 1] : 0;
      f[i][j] = e + north + d;
    }
  }
  _delannoyMemo.set(n, f);
  return f;
}
function DelannoyPathCount(n: number): number {
  if (n < 0) return 0;
  return delannoyTable(n)[0][0];
}
function DelannoyPathUnrank(n: number, rank: number): number[] {
  if (n <= 0) return [];
  const f = delannoyTable(n);
  const total = f[0][0];
  let r = total ? ((rank % total) + total) % total : 0;
  const out: number[] = [];
  let i = 0,
    j = 0;
  while (i < n || j < n) {
    const blockE = i + 1 <= n ? f[i + 1][j] : 0;
    if (r < blockE) {
      out.push(0);
      i++;
      continue;
    }
    r -= blockE;
    const blockN = j + 1 <= n ? f[i][j + 1] : 0;
    if (r < blockN) {
      out.push(1);
      j++;
      continue;
    }
    r -= blockN;
    out.push(2);
    i++;
    j++;
  }
  return out;
}
function DelannoyPathRank(path: number[], n: number): number {
  if (n <= 0) return 0;
  const f = delannoyTable(n);
  let i = 0,
    j = 0,
    rank = 0;
  for (const step of path) {
    if (step === 0) {
      i++;
      continue;
    }
    const blockE = i + 1 <= n ? f[i + 1][j] : 0;
    rank += blockE;
    if (step === 1) {
      j++;
      continue;
    }
    const blockN = j + 1 <= n ? f[i][j + 1] : 0;
    rank += blockN;
    i++;
    j++;
  }
  return rank;
}
function isDelannoyPathOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e)) return false;
  let i = 0,
    j = 0;
  for (const step of e) {
    if (step === 0) i++;
    else if (step === 1) j++;
    else if (step === 2) {
      i++;
      j++;
    } else return false;
    if (i > n || j > n) return false;
  }
  return i === n && j === n;
}

// ─── RiordanPaths(n): Motzkin paths of length n (steps U=+1,L=0,D=-1) with no LEVEL step taken at
// height 0 — the Riordan numbers (1,0,1,1,3,6,15,36,...; A005043). completions(s,h) = ways to
// finish s steps from height h ending at 0, identical to the Motzkin recursion but with the level
// term dropped when h===0. ────────────────────────────────────────────────────────────────────
const _riordanMemo = new Map<string, number>();
function riordanCompletions(s: number, h: number): number {
  if (h < 0 || h > s) return 0;
  if (s === 0) return h === 0 ? 1 : 0;
  const key = `${s},${h}`;
  let v = _riordanMemo.get(key);
  if (v === undefined) {
    v =
      riordanCompletions(s - 1, h + 1) +
      (h > 0 ? riordanCompletions(s - 1, h) : 0) +
      (h > 0 ? riordanCompletions(s - 1, h - 1) : 0);
    _riordanMemo.set(key, v);
  }
  return v;
}
function RiordanPathCount(n: number): number {
  return n < 0 ? 0 : riordanCompletions(n, 0);
}
/** rank-th Riordan path, steps tried U(1) then L(0, only if h>0) then D(-1). */
function RiordanPathUnrank(n: number, rank: number): number[] {
  const total = RiordanPathCount(n);
  let r = total ? ((rank % total) + total) % total : 0;
  const out: number[] = [];
  let h = 0;
  for (let s = n; s > 0; s--) {
    const up = riordanCompletions(s - 1, h + 1);
    if (r < up) {
      out.push(1);
      h++;
      continue;
    }
    r -= up;
    if (h > 0) {
      const lvl = riordanCompletions(s - 1, h);
      if (r < lvl) {
        out.push(0);
        continue;
      }
      r -= lvl;
    }
    out.push(-1);
    h--;
  }
  return out;
}
function RiordanPathRank(path: number[]): number {
  let r = 0,
    h = 0;
  for (let i = 0; i < path.length; i++) {
    const s = path.length - i;
    const step = path[i];
    if (step === 1) {
      h++;
      continue;
    }
    r += riordanCompletions(s - 1, h + 1);
    if (step === 0) continue;
    if (h > 0) r += riordanCompletions(s - 1, h);
    h--;
  }
  return r;
}
function isRiordanPathOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  let h = 0;
  for (const s of e) {
    if (s !== -1 && s !== 0 && s !== 1) return false;
    if (s === 0 && h === 0) return false;
    h += s;
    if (h < 0) return false;
  }
  return h === 0;
}

// ─── FinePaths(n): Dyck paths of semilength n with no "hills" — an elementary U D arch touching
// the ground on both sides. Every Dyck path decomposes uniquely into a sequence of PRIMITIVE
// blocks at ground level (each U <inner Dyck path> D, touching height 0 only at its own ends); a
// hill is a primitive block whose inner path is empty (block semilength 1). Fine(n) counts
// sequences of primitive blocks, every one of semilength >= 2, summing to n — the Fine numbers
// (1,0,1,1,3,8,21,...; A000957). A block of semilength m contributes CatalanNumber(m-1) choices of
// inner path; unrank/rank walk the blocks left to right, recursing into the (shorter) remainder
// exactly like a composition-into-parts enumeration. ────────────────────────────────────────────
const _fineMemo = new Map<number, number>();
function fineCount(k: number): number {
  if (k < 0) return 0;
  if (k === 0) return 1;
  const cached = _fineMemo.get(k);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let m = 2; m <= k; m++) total += CatalanNumber(m - 1) * fineCount(k - m);
  _fineMemo.set(k, total);
  return total;
}
function FinePathCount(n: number): number {
  return fineCount(n);
}
function finePathUnrankFrom(remaining: number, r: number): number[] {
  if (remaining === 0) return [];
  let rem = r;
  let m = 2;
  for (; m <= remaining; m++) {
    const block = CatalanNumber(m - 1) * fineCount(remaining - m);
    if (rem < block) break;
    rem -= block;
  }
  const restCount = fineCount(remaining - m);
  const innerRank = Math.floor(rem / restCount);
  const restRank = rem % restCount;
  const inner = DyckPathUnrank(m - 1, innerRank);
  const rest = finePathUnrankFrom(remaining - m, restRank);
  return [1, ...inner, 0, ...rest];
}
function FinePathUnrank(n: number, rank: number): number[] {
  const total = FinePathCount(n);
  const r = total ? ((rank % total) + total) % total : 0;
  return finePathUnrankFrom(n, r);
}
function finePathRankFrom(path: number[], remaining: number): number {
  if (remaining === 0) return 0;
  let depth = 0,
    end = 0;
  do {
    depth += path[end] === 1 ? 1 : -1;
    end++;
  } while (depth > 0);
  const m = end / 2;
  const inner = path.slice(1, end - 1);
  const rest = path.slice(end);
  let rank = 0;
  for (let mm = 2; mm < m; mm++) rank += CatalanNumber(mm - 1) * fineCount(remaining - mm);
  const restCount = fineCount(remaining - m);
  rank += DyckPathRank(inner) * restCount;
  rank += finePathRankFrom(rest, remaining - m);
  return rank;
}
function FinePathRank(path: number[]): number {
  return finePathRankFrom(path, path.length / 2);
}
function isFinePathOf(e: unknown, n: number): boolean {
  if (!IsDyckPath(e as number[], n)) return false;
  const path = e as number[];
  let i = 0;
  while (i < path.length) {
    let depth = 0;
    const start = i;
    do {
      depth += path[i] === 1 ? 1 : -1;
      i++;
    } while (depth > 0);
    if (i - start === 2) return false; // hill: an empty-inside U D block
  }
  return true;
}

// ─── LukasiewiczPaths(n): length-(n+1) integer words a_0..a_n (each a_i >= -1, prefix sums stay
// >=0 with the last one landing at -1) in bijection with plane trees on n edges via preorder
// traversal — a_i = (number of children of the i-th node, preorder) - 1. Reuses
// OrderedTree{Unrank,Rank} from kernels-extra.ts (same Catalan(n) count) and just reshapes the
// tree into its preorder child-count word. ──────────────────────────────────────────────────────
function preorderWord(node: OrdTree): number[] {
  const out: number[] = [node.length - 1];
  for (const child of node) out.push(...preorderWord(child));
  return out;
}
function wordToOrderedTree(word: number[], pos: { i: number }): OrdTree {
  const numChildren = word[pos.i] + 1;
  pos.i++;
  const children: OrdTree[] = [];
  for (let c = 0; c < numChildren; c++) children.push(wordToOrderedTree(word, pos));
  return children;
}
function LukasiewiczPathUnrank(n: number, rank: number): number[] {
  return preorderWord(OrderedTreeUnrank(n, rank));
}
function LukasiewiczPathRank(word: number[]): number {
  return OrderedTreeRank(wordToOrderedTree(word, { i: 0 }));
}
function isLukasiewiczPathOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n + 1) return false;
  let needed = 1; // node-slots still awaiting a node, starting with just the root
  for (const a of e) {
    if (typeof a !== "number" || !Number.isInteger(a) || a < -1) return false;
    if (needed <= 0) return false;
    needed += a;
    if (needed < 0) return false;
  }
  return needed === 0;
}

// ─── MotzkinPathsByPeaks(n,k): Motzkin paths of length n with exactly k peaks — a peak is an
// up-step immediately followed by a down-step — the Motzkin triangle (A055151).
// completions(s,h,prevUp,peaksLeft) tracks steps remaining, current height, whether the previous
// step was an up-step (so an immediate down-step scores a peak), and peaks still to place. ──────
const _mpbpMemo = new Map<string, number>();
function mpbpCompletions(s: number, h: number, prevUp: boolean, peaksLeft: number): number {
  if (h < 0 || peaksLeft < 0) return 0;
  if (s === 0) return h === 0 && peaksLeft === 0 ? 1 : 0;
  const key = `${s},${h},${prevUp},${peaksLeft}`;
  let v = _mpbpMemo.get(key);
  if (v === undefined) {
    const up = mpbpCompletions(s - 1, h + 1, true, peaksLeft);
    const level = mpbpCompletions(s - 1, h, false, peaksLeft);
    const down = h > 0 ? mpbpCompletions(s - 1, h - 1, false, peaksLeft - (prevUp ? 1 : 0)) : 0;
    v = up + level + down;
    _mpbpMemo.set(key, v);
  }
  return v;
}
function MotzkinPathsByPeaksCount(n: number, k: number): number {
  if (n < 0 || k < 0) return 0;
  return mpbpCompletions(n, 0, false, k);
}
function MotzkinPathsByPeaksUnrank(n: number, k: number, rank: number): number[] {
  const total = MotzkinPathsByPeaksCount(n, k);
  let r = total ? ((rank % total) + total) % total : 0;
  const out: number[] = [];
  let h = 0,
    prevUp = false,
    peaksLeft = k;
  for (let s = n; s > 0; s--) {
    const up = mpbpCompletions(s - 1, h + 1, true, peaksLeft);
    if (r < up) {
      out.push(1);
      h++;
      prevUp = true;
      continue;
    }
    r -= up;
    const level = mpbpCompletions(s - 1, h, false, peaksLeft);
    if (r < level) {
      out.push(0);
      prevUp = false;
      continue;
    }
    r -= level;
    out.push(-1);
    if (prevUp) peaksLeft--;
    h--;
    prevUp = false;
  }
  return out;
}
function MotzkinPathsByPeaksRank(path: number[], k: number): number {
  let r = 0,
    h = 0,
    prevUp = false,
    peaksLeft = k;
  for (let i = 0; i < path.length; i++) {
    const s = path.length - i;
    const step = path[i];
    if (step === 1) {
      h++;
      prevUp = true;
      continue;
    }
    r += mpbpCompletions(s - 1, h + 1, true, peaksLeft);
    if (step === 0) {
      prevUp = false;
      continue;
    }
    r += mpbpCompletions(s - 1, h, false, peaksLeft);
    if (prevUp) peaksLeft--;
    h--;
    prevUp = false;
  }
  return r;
}
function isMotzkinPathsByPeaksOf(e: unknown, n: number, k: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  let h = 0,
    peaks = 0,
    prevUp = false;
  for (const s of e) {
    if (s !== -1 && s !== 0 && s !== 1) return false;
    if (s === -1 && prevUp) peaks++;
    h += s;
    if (h < 0) return false;
    prevUp = s === 1;
  }
  return h === 0 && peaks === k;
}

// Kept separate from `entriesAfterDyckPathsByHeight` below only so
// collections/src/families/index.ts can splice `latticePathsPathsPartitionsEntries`
// (DyckPathsByHeight) back in at the exact interior position it held before the lattice-paths
// move — §4 step 5. NonCrossingPartitions/NonNestingPartitions/NonCrossingMatchings/
// NonNestingMatchings moved to set-partitions/src/families/matchings.ts, spliced back in here
// by collections/src/families/index.ts — they now carry "SetPartition".
export const entriesBeforeDyckPathsByHeight: NumberKernel[] = [
  {
    head: "GrandDyckPaths",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => KSubsetCount(2 * n, n),
    unrank: ([n], r) => {
      const ups = new Set(KSubsetUnrank(2 * n, n, r));
      return Array.from({ length: 2 * n }, (_, i) => (ups.has(i + 1) ? 1 : 0));
    },
    valid: (e, [n]) => isGrandDyckPathOf(e, n),
    rank: (e) => {
      const path = e as number[];
      const ups: number[] = [];
      for (let i = 0; i < path.length; i++) if (path[i] === 1) ups.push(i + 1);
      return KSubsetRank(ups);
    },
  },
  {
    head: "DelannoyPaths",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => DelannoyPathCount(n),
    unrank: ([n], r) => DelannoyPathUnrank(n, r),
    valid: (e, [n]) => isDelannoyPathOf(e, n),
    rank: (e, [n]) => DelannoyPathRank(e as number[], n),
  },
  {
    head: "RiordanPaths",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => RiordanPathCount(n),
    unrank: ([n], r) => RiordanPathUnrank(n, r),
    valid: (e, [n]) => isRiordanPathOf(e, n),
    rank: (e) => RiordanPathRank(e as number[]),
  },
  {
    head: "FinePaths",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => FinePathCount(n),
    unrank: ([n], r) => FinePathUnrank(n, r),
    valid: (e, [n]) => isFinePathOf(e, n),
    rank: (e) => FinePathRank(e as number[]),
  },
  {
    head: "BallotSequences",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => DyckPathCount(n),
    unrank: ([n], r) => DyckPathUnrank(n, r),
    valid: (e, [n]) => IsDyckPath(e as number[], n),
    rank: (e) => DyckPathRank(e as number[]),
  },
  {
    head: "LukasiewiczPaths",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => CatalanNumber(n),
    unrank: ([n], r) => LukasiewiczPathUnrank(n, r),
    valid: (e, [n]) => isLukasiewiczPathOf(e, n),
    rank: (e) => LukasiewiczPathRank(e as number[]),
  },
];

// DyckPathsByHeight moved to lattice-paths/src/families/paths-partitions.ts, spliced back in
// here by collections/src/families/index.ts — §4 step 5.
export const entriesAfterDyckPathsByHeight: NumberKernel[] = [
  {
    head: "MotzkinPathsByPeaks",
    paramCount: 2,
    kind: "ints",
    count: ([n, k]) => MotzkinPathsByPeaksCount(n, k),
    unrank: ([n, k], r) => MotzkinPathsByPeaksUnrank(n, k, r),
    valid: (e, [n, k]) => isMotzkinPathsByPeaksOf(e, n, k),
    rank: (e, [, k]) => MotzkinPathsByPeaksRank(e as number[], k),
  },
];
