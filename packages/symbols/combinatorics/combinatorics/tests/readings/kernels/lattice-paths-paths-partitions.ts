// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { OrderedTreeRank, OrderedTreeUnrank, type OrdTree } from "../../../collections/src/families/kernels-extra.ts";
import { modRank } from "../../../collections/src/families/kernels.ts";

export function isLukasiewiczPathOf(e: unknown, n: number): boolean {
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

export function wordToOrderedTree(word: number[], pos: { i: number }): OrdTree {
  const numChildren = word[pos.i] + 1;
  pos.i++;
  const children: OrdTree[] = [];
  for (let c = 0; c < numChildren; c++) children.push(wordToOrderedTree(word, pos));
  return children;
}

export function LukasiewiczPathRank(word: number[]): number {
  return OrderedTreeRank(wordToOrderedTree(word, { i: 0 }));
}

// ─── LukasiewiczPaths(n): length-(n+1) integer words a_0..a_n (each a_i >= -1, prefix sums stay
// >=0 with the last one landing at -1) in bijection with plane trees on n edges via preorder
// traversal — a_i = (number of children of the i-th node, preorder) - 1. Reuses
// OrderedTree{Unrank,Rank} from kernels-extra.ts (same Catalan(n) count) and just reshapes the
// tree into its preorder child-count word. ──────────────────────────────────────────────────────
export function preorderWord(node: OrdTree): number[] {
  const out: number[] = [node.length - 1];
  for (const child of node) out.push(...preorderWord(child));
  return out;
}

export function LukasiewiczPathUnrank(n: number, rank: number): number[] {
  return preorderWord(OrderedTreeUnrank(n, rank));
}

export function isDelannoyPathOf(e: unknown, n: number): boolean {
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

// ─── DelannoyPaths(n): lattice paths from (0,0) to (n,n) using East=(1,0), North=(0,1), and
// Diagonal=(1,1) steps — encoded as a token sequence over {0=E,1=N,2=D}. f[i][j] = # completions
// from (i,j) to (n,n). count(n) = f(0,0), the central Delannoy numbers. ────────────────────────
export const _delannoyMemo = new Map<number, number[][]>();

export function delannoyTable(n: number): number[][] {
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

export function DelannoyPathRank(path: number[], n: number): number {
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

export function DelannoyPathUnrank(n: number, rank: number): number[] {
  if (n <= 0) return [];
  const f = delannoyTable(n);
  const total = f[0][0];
  let r = total ? modRank(rank, total) : 0;
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

export function DelannoyPathCount(n: number): number {
  if (n < 0) return 0;
  return delannoyTable(n)[0][0];
}
