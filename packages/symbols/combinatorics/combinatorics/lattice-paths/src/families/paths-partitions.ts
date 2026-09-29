// DyckPathsByHeight split out of collections/src/families/paths-partitions.ts (which mixed
// lattice-paths and set-partitions families) per
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- the only lattice-path family there carrying a top-level `carrier` ("DyckPath").
// DelannoyPaths/LukasiewiczPaths/MotzkinPathsByPeaks joined it (wire-carriers lane A-90): each
// element (list<integer>) matches its carrier's shape (DelannoyPath/LukasiewiczPath/MotzkinPath)
// exactly. GrandDyckPaths/RiordanPaths/FinePaths/BallotSequences declare no carrier at all and
// stay in collections per step 5 rule 4, same as this file's set-partitions-domain families
// (moved separately, see the set-partitions area commit).
import type { NumberKernel } from "../../../collections/src/families/types.ts";
import {
  OrderedTreeUnrank,
  OrderedTreeRank,
  CatalanNumber,
  type OrdTree,
} from "../../../collections/src/families/kernels-extra.ts";

// ─── DelannoyPaths(n): lattice paths from (0,0) to (n,n) using East=(1,0), North=(0,1), and
// Diagonal=(1,1) steps — encoded as a token sequence over {0=E,1=N,2=D}. f[i][j] = # completions
// from (i,j) to (n,n). count(n) = f(0,0), the central Delannoy numbers. ────────────────────────
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

// Kept separate from `entries` below only so collections/src/families/index.ts can splice
// `latticePathsPathsPartitionsBeforeDyckPathsByHeight` (DelannoyPaths, LukasiewiczPaths) back in
// where they held their (now consolidated) position in collections — §4 step 5.
export const entriesBeforeDyckPathsByHeight: NumberKernel[] = [
  {
    head: "DelannoyPaths",
    carrier: "DelannoyPath",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => DelannoyPathCount(n),
    unrank: ([n], r) => DelannoyPathUnrank(n, r),
    valid: (e, [n]) => isDelannoyPathOf(e, n),
    rank: (e, [n]) => DelannoyPathRank(e as number[], n),
  },
  {
    head: "LukasiewiczPaths",
    carrier: "LukasiewiczPath",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => CatalanNumber(n),
    unrank: ([n], r) => LukasiewiczPathUnrank(n, r),
    valid: (e, [n]) => isLukasiewiczPathOf(e, n),
    rank: (e) => LukasiewiczPathRank(e as number[]),
  },
];

export const entries: NumberKernel[] = [
  {
    head: "DyckPathsByHeight",
    carrier: "DyckPath",
    paramCount: 2,
    kind: "ints",
    count: ([n, h]) => DyckPathsByHeightCount(n, h),
    unrank: ([n, h], r) => DyckPathsByHeightUnrank(n, h, r),
    valid: (e, [n, h]) => isDyckPathsByHeightOf(e, n, h),
    rank: (e, [, h]) => DyckPathsByHeightRank(e as number[], h),
  },
  {
    head: "MotzkinPathsByPeaks",
    carrier: "MotzkinPath",
    paramCount: 2,
    kind: "ints",
    count: ([n, k]) => MotzkinPathsByPeaksCount(n, k),
    unrank: ([n, k], r) => MotzkinPathsByPeaksUnrank(n, k, r),
    valid: (e, [n, k]) => isMotzkinPathsByPeaksOf(e, n, k),
    rank: (e, [, k]) => MotzkinPathsByPeaksRank(e as number[], k),
  },
];
