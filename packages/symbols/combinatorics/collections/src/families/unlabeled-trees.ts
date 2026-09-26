// Unlabelled and non-crossing tree families — the isomorphism-class batch. Rooted/free unlabelled
// trees need a canonical form (a fixed generation order) so each isomorphism class is hit exactly
// once; rank = index in that order. Element = level sequence (depths in canonical DFS order, root
// first at depth 0) for the two unlabelled families, and an insertion-choice / arity digit sequence
// for phylogenetic / non-crossing trees — all "ints" kind, matching the catalogued carriers'
// list<integer> shape (see packages/symbols/combinatorics/domains/src/domain-data.ts).
import type { NumberKernel } from "./types.ts";
import { Binomial } from "./kernels-combinatorics.ts";
import { KSubsetUnrank, KSubsetRank } from "./kernels-extra.ts";
import { KAryTreeCount, KAryTreeUnrank, KAryTreeRank, type KTree } from "./kernels-extra.ts";

// ─── shared: multisets drawn from a countable, weighted alphabet ("children of a node, unordered,
// each child itself a smaller rooted tree") — the combinatorial core of both unlabelled families
// below. Reused as: G(remaining, cap) = # multisets of items with weight in {1..cap}, using T(w)
// distinct "letters" of each weight w (T = RootedTreeCount), summing to `remaining`. This is the
// direct (non-recurrence) evaluation of the Euler transform: a multiset is chosen weight-class by
// weight-class, and within a weight class, "pick a sub-multiset of size k from T(w) labels" is the
// standard combinations-with-repetition problem, solved via the existing KSubset colex system under
// the b_i = a_i + i shift (multichoose(T,k) items <-> k-subset of T+k-1). ──────────────────────────
function multichooseCount(T: number, k: number): number {
  if (k === 0) return 1;
  if (T <= 0) return 0;
  return Binomial(T + k - 1, k);
}
function multichooseUnrank(T: number, k: number, rank: number): number[] {
  if (k === 0) return [];
  const elems = KSubsetUnrank(T + k - 1, k, rank); // ascending, 1-based
  return elems.map((e, i) => e - 1 - i); // 0-based, non-decreasing, in [0,T)
}
function multichooseRank(arr: number[]): number {
  const elems = arr.map((a, i) => a + i + 1);
  return KSubsetRank(elems);
}

const _childrenCountMemo = new Map<string, number>();
/** # multisets of rooted-tree "letters" (weights 1..cap, T(w) distinct letters per weight) summing to `remaining`. */
function childrenCount(remaining: number, cap: number): number {
  if (remaining === 0) return 1;
  if (cap <= 0) return 0;
  const key = `${remaining},${cap}`;
  const hit = _childrenCountMemo.get(key);
  if (hit !== undefined) return hit;
  const Tw = RootedTreeCount(cap);
  let total = 0;
  for (let k = 0; k * cap <= remaining; k++)
    total += multichooseCount(Tw, k) * childrenCount(remaining - k * cap, cap - 1);
  _childrenCountMemo.set(key, total);
  return total;
}

const _rootedCountMemo = new Map<number, number>();
/** RootedUnlabeledTrees(n): A000081 — rooted trees on n unlabelled nodes, children unordered. */
export function RootedTreeCount(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  const hit = _rootedCountMemo.get(n);
  if (hit !== undefined) return hit;
  const v = childrenCount(n - 1, n - 1);
  _rootedCountMemo.set(n, v);
  return v;
}

/** unrank a children-multiset of total weight `remaining`, letters of weight 1..cap: returns the
 *  chosen children as their own (0-based) level sequences, in canonical order (weight descending,
 *  ties by ascending own-rank). */
function unrankChildrenMultiset(remaining: number, cap: number, rank: number): number[][] {
  if (remaining === 0) return [];
  let r = rank;
  for (let w = cap; w >= 1; w--) {
    const Tw = RootedTreeCount(w);
    const restCap = w - 1;
    for (let k = 0; k * w <= remaining; k++) {
      const waysRest = childrenCount(remaining - k * w, restCap);
      const block = multichooseCount(Tw, k) * waysRest;
      if (r < block) {
        const typeIdx = waysRest ? Math.floor(r / waysRest) : 0;
        const restRank = waysRest ? r % waysRest : 0;
        const types = multichooseUnrank(Tw, k, typeIdx);
        const kids = types.map((t) => RootedTreeUnrank(w, t));
        return [...kids, ...unrankChildrenMultiset(remaining - k * w, restCap, restRank)];
      }
      r -= block;
    }
  }
  return [];
}

export function RootedTreeUnrank(n: number, rank: number): number[] {
  if (n <= 1) return [0];
  const total = RootedTreeCount(n);
  const r = total ? ((rank % total) + total) % total : 0;
  const kids = unrankChildrenMultiset(n - 1, n - 1, r);
  return [0, ...kids.flatMap((seq) => seq.map((d) => d + 1))];
}

/** split a root's flattened children (depths >=1, relative to the root) into each child's own
 *  0-based level sequence — a maximal run starting at depth 1, followed by depths > 1. */
function splitChildren(seq: number[]): number[][] {
  const blocks: number[][] = [];
  let i = 0;
  while (i < seq.length) {
    let j = i + 1;
    while (j < seq.length && seq[j] > 1) j++;
    blocks.push(seq.slice(i, j).map((d) => d - 1));
    i = j;
  }
  return blocks;
}

/** rank of a children-multiset (given as its already-split child blocks, in the order they occur)
 *  against the same weight-descending generation order `unrankChildrenMultiset` uses. */
function childrenRank(remaining: number, cap: number, kids: number[][]): number {
  if (remaining === 0) return 0;
  let base = 0;
  let idx = 0;
  let rem = remaining;
  for (let w = cap; w >= 1; w--) {
    const Tw = RootedTreeCount(w);
    const restCap = w - 1;
    let k = 0;
    while (idx + k < kids.length && kids[idx + k].length === w) k++;
    for (let kk = 0; kk < k; kk++) base += multichooseCount(Tw, kk) * childrenCount(rem - kk * w, restCap);
    if (k > 0) {
      const waysRest = childrenCount(rem - k * w, restCap);
      const types = kids.slice(idx, idx + k).map((seq) => RootedTreeRank(seq));
      base += multichooseRank(types) * waysRest;
      idx += k;
      rem -= k * w;
    }
  }
  return base;
}

export function RootedTreeRank(seq: number[]): number {
  const n = seq.length;
  if (n <= 1) return 0;
  return childrenRank(n - 1, n - 1, splitChildren(seq.slice(1)));
}

/** canonical-order check shared by rooted and free trees: children weight-descending, and within a
 *  weight, own-rank ascending (breaking the "any consistent order is fine" tie deterministically —
 *  this IS the well-formedness that makes rank∘unrank a bijection). `capW` bounds a child's weight
 *  (n-1 for plain rooted trees; floor(n/2) for the free-tree centroid branches below). */
function isCanonicalChildren(kids: number[][], capW: number): boolean {
  for (let i = 0; i < kids.length; i++) if (kids[i].length > capW) return false;
  for (let i = 1; i < kids.length; i++) if (kids[i].length > kids[i - 1].length) return false;
  let i = 0;
  while (i < kids.length) {
    let j = i + 1;
    while (j < kids.length && kids[j].length === kids[i].length) j++;
    const ranks = kids.slice(i, j).map((k) => RootedTreeRank(k));
    for (let t = 1; t < ranks.length; t++) if (ranks[t] < ranks[t - 1]) return false;
    for (let t = i; t < j; t++) if (!IsRootedTreeOf(kids[t], kids[t].length)) return false;
    i = j;
  }
  return true;
}

export function IsRootedTreeOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n || n < 1) return false;
  if (e[0] !== 0) return false;
  for (let i = 1; i < e.length; i++) {
    const d = e[i];
    if (!Number.isInteger(d) || d < 1 || d > e[i - 1] + 1) return false;
  }
  if (n === 1) return true;
  return isCanonicalChildren(splitChildren((e as number[]).slice(1)), n - 1);
}

// ─── UnlabeledFreeTrees(n): A000055 — free (unrooted) trees, canonically rooted at their centroid.
// A vertex is a valid centroid-rooting iff every branch (child subtree) has weight <= floor(n/2); call
// that count V(n) (a direct specialization of the multiset recursion above, capped at m=floor(n/2)
// instead of n-1). Every free tree with a UNIQUE centroid contributes exactly one entry to V(n). A
// free tree with a CENTRAL EDGE (n even, splitting into two equal halves A, B of weight m) contributes
// one entry per root choice: 1 entry if A≅B (rooting at either centroid gives the same rooted-tree
// class — already correct, no fix needed), 2 entries if A≇B (the two roots give two distinct classes
// for the same free tree — a genuine double count). So F(n) = V(n) - C(T(m),2): subtract exactly the
// unordered {A,B} pairs with A≇B (Otter 1948). The canonical representative for such a pair is fixed
// by requiring branch-rank <= "rest of the tree" rank (a root-of-size-m in its own right) — a
// triangular (0<=t_b<=t_a<T(m)) sub-index, laid out after the "no centroid-boundary branch" block. ──
const _freeCountMemo = new Map<number, number>();
export function FreeTreeCount(n: number): number {
  if (n <= 0) return 0;
  const hit = _freeCountMemo.get(n);
  if (hit !== undefined) return hit;
  const m = Math.floor(n / 2);
  const Vn = childrenCount(n - 1, m);
  const v = n % 2 === 0 ? Vn - Binomial(RootedTreeCount(m), 2) : Vn;
  _freeCountMemo.set(n, v);
  return v;
}

export function FreeTreeUnrank(n: number, rank: number): number[] {
  if (n <= 1) return [0];
  const m = Math.floor(n / 2);
  const total = FreeTreeCount(n);
  const r = total ? ((rank % total) + total) % total : 0;
  if (n % 2 !== 0) {
    const kids = unrankChildrenMultiset(n - 1, m, r);
    return [0, ...kids.flatMap((seq) => seq.map((d) => d + 1))];
  }
  const K0 = childrenCount(n - 1, m - 1);
  if (r < K0) {
    const kids = unrankChildrenMultiset(n - 1, m - 1, r);
    return [0, ...kids.flatMap((seq) => seq.map((d) => d + 1))];
  }
  let r2 = r - K0;
  const Tm = RootedTreeCount(m);
  let tb = 0;
  for (;;) {
    const rowLen = Tm - tb;
    if (r2 < rowLen) break;
    r2 -= rowLen;
    tb++;
  }
  const ta = tb + r2;
  const branch = RootedTreeUnrank(m, tb);
  const rootPart = RootedTreeUnrank(m, ta);
  const kids = [branch, ...splitChildren(rootPart.slice(1))];
  return [0, ...kids.flatMap((seq) => seq.map((d) => d + 1))];
}

export function FreeTreeRank(seq: number[]): number {
  const n = seq.length;
  if (n <= 1) return 0;
  const m = Math.floor(n / 2);
  const kids = splitChildren(seq.slice(1));
  if (n % 2 !== 0 || kids.length === 0 || kids[0].length < m) {
    return childrenRank(n - 1, m - (n % 2 === 0 ? 1 : 0), kids);
  }
  // kids[0] carries the (unique, by the weight budget) centroid-boundary branch.
  const K0 = childrenCount(n - 1, m - 1);
  const branchRank = RootedTreeRank(kids[0]);
  const rootPart = [0, ...kids.slice(1).flatMap((s) => s.map((d) => d + 1))];
  const rootPartRank = RootedTreeRank(rootPart);
  const Tm = RootedTreeCount(m);
  let offset = 0;
  for (let t = 0; t < branchRank; t++) offset += Tm - t;
  return K0 + offset + (rootPartRank - branchRank);
}

export function IsFreeTreeOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n || n < 1) return false;
  if (e[0] !== 0) return false;
  for (let i = 1; i < e.length; i++) {
    const d = e[i];
    if (!Number.isInteger(d) || d < 1 || d > e[i - 1] + 1) return false;
  }
  if (n === 1) return true;
  const m = Math.floor(n / 2);
  const kids = splitChildren((e as number[]).slice(1));
  if (!isCanonicalChildren(kids, m)) return false;
  if (n % 2 === 0 && kids.length > 0 && kids[0].length === m) {
    const branchRank = RootedTreeRank(kids[0]);
    const rootPart = [0, ...kids.slice(1).flatMap((s) => s.map((d) => d + 1))];
    if (!IsRootedTreeOf(rootPart, m)) return false;
    if (branchRank > RootedTreeRank(rootPart)) return false;
  }
  return true;
}

// ─── PhylogeneticTrees(n): A001147 — rooted binary trees on n labeled leaves (internal nodes
// unlabeled), built by successive insertion: start with leaves {1,2} as a cherry, then for
// k=3..n attach leaf k at one of (2k-3) places — the "above the current root" slot, or one of the
// tree's (2k-4) edges, each subdivided with a fresh internal node whose children are [existing
// subtree, leaf k] — enumerated in a fixed preorder-of-non-root-nodes order. Element = the digit
// sequence (d_3..d_n), d_k in [0, 2k-3) — the same factorial-number-system shape RecursiveTrees
// uses, just with each step's radix taken from the tree built so far. ─────────────────────────────
type PNode = number | [PNode, PNode];
function preorderPaths(t: PNode, path: number[] = []): number[][] {
  if (typeof t === "number") return [path];
  return [path, ...preorderPaths(t[0], [...path, 0]), ...preorderPaths(t[1], [...path, 1])];
}
function getAt(t: PNode, path: number[]): PNode {
  let cur = t;
  for (const d of path) cur = (cur as [PNode, PNode])[d];
  return cur;
}
function replaceAt(t: PNode, path: number[], node: PNode): PNode {
  if (path.length === 0) return node;
  const [l, r] = t as [PNode, PNode];
  const [d, ...rest] = path;
  return d === 0 ? [replaceAt(l, rest, node), r] : [l, replaceAt(r, rest, node)];
}
function findLeafPath(t: PNode, label: number): number[] | undefined {
  if (typeof t === "number") return t === label ? [] : undefined;
  const l = findLeafPath(t[0], label);
  if (l) return [0, ...l];
  const r = findLeafPath(t[1], label);
  if (r) return [1, ...r];
  return undefined;
}
function insertLeaf(t: PNode, k: number, slot: number): PNode {
  if (slot === 0) return [t, k];
  const path = preorderPaths(t).slice(1)[slot - 1];
  return replaceAt(t, path, [getAt(t, path), k]);
}

export function PhylogeneticTreeCount(n: number): number {
  if (n <= 2) return 1;
  let c = 1;
  for (let k = 3; k <= n; k++) c *= 2 * k - 3;
  return c;
}
export function PhylogeneticTreeUnrank(n: number, rank: number): number[] {
  if (n <= 2) return [];
  const total = PhylogeneticTreeCount(n);
  let rem = total ? ((rank % total) + total) % total : 0;
  const digits = Array.from({ length: n - 2 }, () => 0);
  for (let k = n; k >= 3; k--) {
    const base = 2 * k - 3;
    digits[k - 3] = rem % base;
    rem = Math.floor(rem / base);
  }
  let t: PNode = [1, 2];
  for (let k = 3; k <= n; k++) t = insertLeaf(t, k, digits[k - 3]);
  return digits;
}
export function PhylogeneticTreeRank(digits: number[], n: number): number {
  if (n <= 2) return 0;
  let t: PNode = [1, 2];
  for (let k = 3; k <= n; k++) t = insertLeaf(t, k, digits[k - 3]);
  let rank = 0,
    place = 1;
  for (let k = n; k >= 3; k--) {
    const parentPath = findLeafPath(t, k)!.slice(0, -1);
    let d: number;
    if (parentPath.length === 0) {
      d = 0;
      t = getAt(t, [0]); // above-root case: contract to the old (left) subtree
    } else {
      const x = getAt(t, parentPath) as [PNode, PNode];
      t = replaceAt(t, parentPath, x[0]); // contract M -> its left (pre-existing) child
      d =
        1 +
        preorderPaths(t)
          .slice(1)
          .findIndex((p) => p.join(",") === parentPath.join(","));
    }
    rank += d * place;
    place *= 2 * k - 3;
  }
  return rank;
}
export function IsPhylogeneticTreeOf(e: unknown, n: number): boolean {
  const len = Math.max(0, n - 2);
  if (!Array.isArray(e) || e.length !== len) return false;
  for (let i = 0; i < len; i++) {
    const k = i + 3;
    const d = e[i];
    if (!Number.isInteger(d) || d < 0 || d >= 2 * k - 3) return false;
  }
  return true;
}

// ─── NonCrossingTrees(n): A001764 — spanning trees on n+1 circle-labeled points with no crossing
// chords; C(3n,n)/(2n+1), the same Fuss–Catalan closed form as ternary trees with n internal nodes
// (Flajolet & Noy, "Analytic combinatorics of non-crossing configurations", 1999, give the bijection
// explicitly). Reuses the already-certified KAryTrees(n,3) kernel and just re-presents its nested
// element as the flat preorder arity word (n entries, each in 0..3) the "ints" carrier wants. ──────
function flattenKAry(t: KTree, k: number, out: number[]): void {
  if (t === 0) {
    out.push(0);
    return;
  }
  out.push(k);
  for (const c of t) flattenKAry(c, k, out);
}
function unflattenKAry(word: number[], pos: { i: number }): KTree {
  const a = word[pos.i++];
  if (a === 0) return 0;
  const kids: KTree[] = [];
  for (let c = 0; c < a; c++) kids.push(unflattenKAry(word, pos));
  return kids as KTree; // a is always exactly 3 here (KAryTrees(·,3) fills every internal node's 3 slots)
}
export function NonCrossingTreeCount(n: number): number {
  return KAryTreeCount(n, 3);
}
export function NonCrossingTreeUnrank(n: number, rank: number): number[] {
  const t = KAryTreeUnrank(n, 3, rank);
  const out: number[] = [];
  flattenKAry(t, 3, out);
  return out;
}
export function NonCrossingTreeRank(word: number[]): number {
  const t = unflattenKAry(word, { i: 0 });
  return KAryTreeRank(t, 3);
}
export function IsNonCrossingTreeOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e)) return false;
  // a valid preorder arity word: a single stack-based scan consumes exactly the whole word once,
  // with exactly n internal (arity-3) nodes — the n-internal-node ternary tree the bijection wants.
  let need = 1;
  let internal = 0;
  for (const a of e) {
    if (a !== 0 && a !== 3) return false;
    if (a === 3) internal++;
    need--;
    if (need < 0) return false;
    need += a;
  }
  return need === 0 && internal === n;
}

export const entries: NumberKernel[] = [
  {
    head: "RootedUnlabeledTrees",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => RootedTreeCount(n),
    unrank: ([n], r) => RootedTreeUnrank(n, r),
    valid: (e, [n]) => IsRootedTreeOf(e, n),
    rank: (e) => RootedTreeRank(e as number[]),
  },
  {
    head: "UnlabeledFreeTrees",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => FreeTreeCount(n),
    unrank: ([n], r) => FreeTreeUnrank(n, r),
    valid: (e, [n]) => IsFreeTreeOf(e, n),
    rank: (e) => FreeTreeRank(e as number[]),
  },
  {
    head: "PhylogeneticTrees",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => PhylogeneticTreeCount(n),
    unrank: ([n], r) => PhylogeneticTreeUnrank(n, r),
    valid: (e, [n]) => IsPhylogeneticTreeOf(e, n),
    rank: (e, [n]) => PhylogeneticTreeRank(e as number[], n),
  },
  {
    head: "NonCrossingTrees",
    paramCount: 1,
    kind: "ints",
    count: ([n]) => NonCrossingTreeCount(n),
    unrank: ([n], r) => NonCrossingTreeUnrank(n, r),
    valid: (e, [n]) => IsNonCrossingTreeOf(e, n),
    rank: (e) => NonCrossingTreeRank(e as number[]),
  },
];
