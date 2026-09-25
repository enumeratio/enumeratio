// Lattice-path variants and non-crossing/non-nesting set-partition families. Pure rank/unrank
// kernels over plain JS numbers/arrays (no compute-engine dependency) — same contract as every
// other pack: rank(unrank(p, r), p) === r, valid(unrank(p, r), p) === true for all r in
// [0, count(p)). Kept in its own file (registered via install.ts) so parallel roadmap batches
// don't collide with core.ts.
import type { FamilyKernel } from "./types.ts";
import { BellB, RgsRank, RgsUnrank } from "./kernels-combinatorics.ts";
import {
  CatalanNumber,
  DyckPathCount,
  DyckPathRank,
  DyckPathUnrank,
  IsDyckPath,
  IsPerfectMatchingOf,
  KSubsetCount,
  KSubsetRank,
  KSubsetUnrank,
  OrderedTreeRank,
  OrderedTreeUnrank,
  type OrdTree,
} from "./kernels-extra.ts";

// ─── RestrictedGrowthStrings(n): length-n words w with w[0]=0 and w[i] <= 1+max(w[0..i-1]) — the
// canonical RGS encoding of a set partition of [n] (w[i] = block index of element i+1, in
// first-appearance order). Count = BellB(n); SetPartitions already unranks via this exact word
// (RgsUnrank/RgsRank in kernels-combinatorics.ts) and just reshapes it into blocks — here the word
// itself IS the element. ───────────────────────────────────────────────────────────────────────
function isRestrictedGrowthStringOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  let mx = -1;
  for (const v of e) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > mx + 1) return false;
    if (v > mx) mx = v;
  }
  return true;
}

// ─── NonCrossingPartitions(n) / NonNestingPartitions(n): both built from ONE shared process —
// walk elements 1..n, at each step either open a new block (its least element) or extend one of
// the currently open block "tails" (a tail = a block's current greatest element, awaiting a
// possible successor). With `a` tails open (ascending v_1<...<v_a), extending v_j:
//   - stack rule (non-crossing): every LARGER open tail freezes forever (touching one later would
//     cross the arc just drawn) — survivors are v_1..v_{j-1}, plus the new tail.
//   - queue rule (non-nesting): every SMALLER open tail freezes forever (touching one later would
//     nest inside the arc just drawn) — survivors are v_{j+1}..v_a, plus the new tail.
// Either way exactly j-1 (stack) or a-j (queue) old tails survive, so the counting recursion
// f(t,a) = f(t-1,a+1) + sum_{m=1}^{a} f(t-1,m), f(0,a)=1, is IDENTICAL for both rules — f(n,0) =
// CatalanNumber(n). Crossing/nesting are judged on each block's CONSECUTIVE-element arcs (block
// {x1<x2<...} contributes arcs (x1,x2),(x2,x3),...), the standard arc-diagram reading under which
// non-nesting partitions are also Catalan-counted. ─────────────────────────────────────────────
type TailMode = "stack" | "queue";

const _tailTableMemo = new Map<number, number[][]>();
function buildTailLevelTable(n: number): number[][] {
  const cached = _tailTableMemo.get(n);
  if (cached) return cached;
  const maxA = n + 1;
  const f: number[][] = Array.from({ length: n + 1 }, () => new Array(maxA + 1).fill(0));
  for (let a = 0; a <= maxA; a++) f[0][a] = 1;
  for (let t = 1; t <= n; t++) {
    const prev = f[t - 1];
    const prefix = new Array(maxA + 1).fill(0);
    for (let a = 1; a <= maxA; a++) prefix[a] = prefix[a - 1] + prev[a];
    for (let a = 0; a <= maxA; a++) f[t][a] = (a + 1 <= maxA ? prev[a + 1] : 0) + prefix[a];
  }
  _tailTableMemo.set(n, f);
  return f;
}

/** Weight of "extend the j-th-smallest (1-indexed) of `a` open tails" at level `t-1`. */
function tailExtendWeight(f: number[][], t: number, a: number, j: number, mode: TailMode): number {
  return mode === "stack" ? f[t - 1][j] : f[t - 1][a - j + 1];
}

/** Which open tails (0-indexed slice of the ascending `available` array) survive extending index j-1. */
function tailSurvivors<T>(available: T[], j: number, mode: TailMode): T[] {
  return mode === "stack" ? available.slice(0, j - 1) : available.slice(j);
}

function unrankTailPartition(n: number, r: number, mode: TailMode): number[][] {
  if (n === 0) return [];
  const f = buildTailLevelTable(n);
  let available: Array<{ value: number; blockId: number }> = [];
  const blocks: number[][] = [];
  let rem = r;
  for (let i = 1; i <= n; i++) {
    const a = available.length;
    const t = n - i + 1;
    const openSize = f[t - 1][a + 1];
    if (rem < openSize) {
      const blockId = blocks.length;
      blocks.push([i]);
      available = [...available, { value: i, blockId }];
      continue;
    }
    rem -= openSize;
    let j = 1;
    for (;;) {
      const size = tailExtendWeight(f, t, a, j, mode);
      if (rem < size) break;
      rem -= size;
      j++;
    }
    const chosen = available[j - 1];
    blocks[chosen.blockId].push(i);
    available = [...tailSurvivors(available, j, mode), { value: i, blockId: chosen.blockId }];
  }
  return blocks;
}

function rankTailPartition(blocks: number[][], n: number, mode: TailMode): number {
  const blockIndexOf = new Array(n + 1).fill(-1);
  blocks.forEach((b, bi) => b.forEach((x) => (blockIndexOf[x] = bi)));
  const predOf = new Array(n + 1).fill(0); // predOf[x] = element right before x in its block (0 = block minimum)
  blocks.forEach((b) => {
    const sorted = [...b].sort((x, y) => x - y);
    for (let k = 1; k < sorted.length; k++) predOf[sorted[k]] = sorted[k - 1];
  });
  const f = buildTailLevelTable(n);
  let available: Array<{ value: number; blockId: number }> = [];
  let rank = 0;
  for (let i = 1; i <= n; i++) {
    const a = available.length;
    const t = n - i + 1;
    const bi = blockIndexOf[i];
    if (predOf[i] === 0) {
      available = [...available, { value: i, blockId: bi }];
      continue; // "open new block" is always ordered first — contributes 0 to rank
    }
    const p = predOf[i];
    const idx = available.findIndex((en) => en.value === p);
    const j = idx + 1;
    rank += f[t - 1][a + 1]; // the open-branch precedes every extend-branch
    for (let jj = 1; jj < j; jj++) rank += tailExtendWeight(f, t, a, jj, mode);
    available = [...tailSurvivors(available, j, mode), { value: i, blockId: bi }];
  }
  return rank;
}

function canonicalBlocksOf(e: unknown): number[][] | undefined {
  if (!Array.isArray(e)) return undefined;
  const out: number[][] = [];
  const seen = new Set<number>();
  for (const b of e) {
    if (!Array.isArray(b) || b.length === 0) return undefined;
    const sorted = [...b].sort((x, y) => x - y);
    for (const x of sorted) {
      if (typeof x !== "number" || !Number.isInteger(x) || seen.has(x)) return undefined;
      seen.add(x);
    }
    out.push(sorted);
  }
  return out;
}

function isSetPartitionShape(blocks: number[][], n: number): boolean {
  let total = 0;
  for (const b of blocks) {
    for (const x of b) {
      if (x < 1 || x > n) return false;
      total++;
    }
  }
  return total === n;
}

function blockIndexArray(blocks: number[][], n: number): number[] {
  const blockOf = new Array(n + 1).fill(-1);
  blocks.forEach((b, bi) => b.forEach((x) => (blockOf[x] = bi)));
  return blockOf;
}

/** No a<b<c<d with a,c in one block and b,d in another (their arcs interleave). */
function hasCrossingBlocks(blockOf: number[], n: number): boolean {
  for (let a = 1; a <= n; a++)
    for (let b = a + 1; b <= n; b++)
      for (let c = b + 1; c <= n; c++)
        for (let d = c + 1; d <= n; d++)
          if (blockOf[a] === blockOf[c] && blockOf[b] === blockOf[d] && blockOf[a] !== blockOf[b])
            return true;
  return false;
}

/** No consecutive-in-block arc (i1,i2) properly containing a consecutive-in-block arc (j1,j2)
 *  from a different block: i1<j1<j2<i2. */
function hasNestingBlocks(blocks: number[][]): boolean {
  const arcs: Array<[number, number]> = [];
  for (const b of blocks) for (let k = 1; k < b.length; k++) arcs.push([b[k - 1], b[k]]);
  for (let i = 0; i < arcs.length; i++)
    for (let j = 0; j < arcs.length; j++) {
      if (i === j) continue;
      const [i1, i2] = arcs[i];
      const [j1, j2] = arcs[j];
      if (i1 < j1 && j2 < i2) return true;
    }
  return false;
}

// ─── NonCrossingMatchings(n) / NonNestingMatchings(n): perfect matchings of [2n] in bijection with
// Dyck paths of semilength n — walk points 1..2n, an up-step opens a point, a down-step closes the
// MOST RECENTLY opened still-open point (stack/non-crossing, the balanced-parenthesis reading) or
// the EARLIEST still-open point (queue/non-nesting). Count = DyckPathCount(n); reuses
// IsPerfectMatchingOf from kernels-extra.ts for the base "is this a perfect matching" check. ─────
type MatchMode = "stack" | "queue";

function matchingFromDyckSteps(steps: number[], mode: MatchMode): number[][] {
  const open: number[] = [];
  const pairs: number[][] = [];
  for (let i = 0; i < steps.length; i++) {
    const point = i + 1;
    if (steps[i] === 1) {
      open.push(point);
    } else {
      const partner = (mode === "stack" ? open.pop() : open.shift()) as number;
      pairs.push([Math.min(partner, point), Math.max(partner, point)]);
    }
  }
  return pairs.sort((a, b) => a[0] - b[0]);
}

function dyckStepsFromMatching(pairs: number[][], n: number, mode: MatchMode): number[] {
  const partnerOf = new Array(2 * n + 1).fill(0);
  for (const [a, b] of pairs) {
    partnerOf[a] = b;
    partnerOf[b] = a;
  }
  const steps: number[] = [];
  const open: number[] = [];
  for (let point = 1; point <= 2 * n; point++) {
    if (partnerOf[point] > point) {
      steps.push(1);
      open.push(point);
    } else {
      steps.push(0);
      if (mode === "stack") open.pop();
      else open.shift();
    }
  }
  return steps;
}

function hasCrossingChords(pairs: number[][]): boolean {
  for (const [a, b] of pairs) for (const [c, d] of pairs) if (a < c && c < b && b < d) return true;
  return false;
}

function hasNestingChords(pairs: number[][]): boolean {
  for (const [a, b] of pairs) for (const [c, d] of pairs) if (a < c && d < b) return true;
  return false;
}

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

// ─── DyckPathsByHeight(n,h): Dyck paths of semilength n with maximum height EXACTLY h.
// completions(s,height,reached) tracks steps remaining, current height (capped at h), and whether
// height h has been touched yet; count(n,h) = completions(2n,0,h===0). unrank/rank walk up-then-
// down exactly like plain DyckPaths, just within the height cap and the "must touch h" bookkeeping. ─
const _dpbhMemo = new Map<string, number>();
function dpbhCompletions(s: number, height: number, cap: number, reached: boolean): number {
  if (height < 0 || height > cap) return 0;
  if (s === 0) return height === 0 && reached ? 1 : 0;
  const key = `${s},${height},${cap},${reached}`;
  let v = _dpbhMemo.get(key);
  if (v === undefined) {
    const upH = height + 1;
    const up = upH <= cap ? dpbhCompletions(s - 1, upH, cap, reached || upH === cap) : 0;
    const down = height > 0 ? dpbhCompletions(s - 1, height - 1, cap, reached) : 0;
    v = up + down;
    _dpbhMemo.set(key, v);
  }
  return v;
}
function DyckPathsByHeightCount(n: number, h: number): number {
  if (n < 0 || h < 0) return 0;
  return dpbhCompletions(2 * n, 0, h, h === 0);
}
function DyckPathsByHeightUnrank(n: number, h: number, rank: number): number[] {
  const total = DyckPathsByHeightCount(n, h);
  let r = total ? ((rank % total) + total) % total : 0;
  const out: number[] = [];
  let height = 0;
  let reached = h === 0;
  for (let s = 2 * n; s > 0; s--) {
    const upH = height + 1;
    const up = upH <= h ? dpbhCompletions(s - 1, upH, h, reached || upH === h) : 0;
    if (r < up) {
      out.push(1);
      height = upH;
      reached = reached || upH === h;
      continue;
    }
    r -= up;
    out.push(0);
    height--;
  }
  return out;
}
function DyckPathsByHeightRank(path: number[], h: number): number {
  let r = 0;
  let height = 0;
  let reached = h === 0;
  for (let i = 0; i < path.length; i++) {
    const s = path.length - i;
    if (path[i] === 1) {
      const upH = height + 1;
      height = upH; // up is always tried first — contributes 0 to rank
      reached = reached || upH === h;
    } else {
      const upH = height + 1;
      const up = upH <= h ? dpbhCompletions(s - 1, upH, h, reached || upH === h) : 0;
      r += up;
      height--;
    }
  }
  return r;
}
function isDyckPathsByHeightOf(e: unknown, n: number, h: number): boolean {
  if (!Array.isArray(e) || e.length !== 2 * n) return false;
  let height = 0,
    maxHeight = 0;
  for (const s of e) {
    if (s !== 0 && s !== 1) return false;
    height += s === 1 ? 1 : -1;
    if (height < 0) return false;
    if (height > maxHeight) maxHeight = height;
  }
  return height === 0 && maxHeight === h;
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

export const entries: FamilyKernel[] = [
  {
    head: "RestrictedGrowthStrings",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => BellB(n),
    unrank: ([n], r) => RgsUnrank(n, r),
    valid: (e, [n]) => isRestrictedGrowthStringOf(e, n),
    rank: (e) => RgsRank(e as number[]),
  },
  {
    head: "NonCrossingPartitions",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => CatalanNumber(n),
    unrank: ([n], r) => unrankTailPartition(n, r, "stack"),
    valid: (e, [n]) => {
      const blocks = canonicalBlocksOf(e);
      if (!blocks || !isSetPartitionShape(blocks, n)) return false;
      return !hasCrossingBlocks(blockIndexArray(blocks, n), n);
    },
    rank: (e, [n]) => rankTailPartition(e as number[][], n, "stack"),
  },
  {
    head: "NonNestingPartitions",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => CatalanNumber(n),
    unrank: ([n], r) => unrankTailPartition(n, r, "queue"),
    valid: (e, [n]) => {
      const blocks = canonicalBlocksOf(e);
      if (!blocks || !isSetPartitionShape(blocks, n)) return false;
      return !hasNestingBlocks(blocks);
    },
    rank: (e, [n]) => rankTailPartition(e as number[][], n, "queue"),
  },
  {
    head: "NonCrossingMatchings",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => DyckPathCount(n),
    unrank: ([n], r) => matchingFromDyckSteps(DyckPathUnrank(n, r), "stack"),
    valid: (e, [n]) => IsPerfectMatchingOf(e, n) && !hasCrossingChords(e as number[][]),
    rank: (e, [n]) => DyckPathRank(dyckStepsFromMatching(e as number[][], n, "stack")),
  },
  {
    head: "NonNestingMatchings",
    paramCount: 1,
    kind: "blocks",
    count: ([n]) => DyckPathCount(n),
    unrank: ([n], r) => matchingFromDyckSteps(DyckPathUnrank(n, r), "queue"),
    valid: (e, [n]) => IsPerfectMatchingOf(e, n) && !hasNestingChords(e as number[][]),
    rank: (e, [n]) => DyckPathRank(dyckStepsFromMatching(e as number[][], n, "queue")),
  },
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
  {
    head: "DyckPathsByHeight",
    paramCount: 2,
    kind: "ints",
    count: ([n, h]) => DyckPathsByHeightCount(n, h),
    unrank: ([n, h], r) => DyckPathsByHeightUnrank(n, h, r),
    valid: (e, [n, h]) => isDyckPathsByHeightOf(e, n, h),
    rank: (e, [, h]) => DyckPathsByHeightRank(e as number[], h),
  },
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
