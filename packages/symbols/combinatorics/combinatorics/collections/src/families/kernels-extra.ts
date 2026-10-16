// Fresh collections with no SQL twin — authored here, certified by the package's own bijection differential
// (enumerate-all: distinct, valid, count = closed form; and Rank∘At = id). Any consistent order is correct for
// a new collection, so these pick the simplest bijection. PascalCase heads == kernel names.

import { Binomial, mulDiv } from "./kernels-combinatorics.ts";
import { Factorial, PermutationRank, PermutationUnrank, floorDiv, modRank } from "./kernels.ts";

// ─── Subsets(n): the power set of [n]. Order = binary value of the membership mask. ─────────────────────
// ─── k-subsets of [n] in colex order (the combinatorial number system). Not KSubsets, which is lexicographic. ───────────────────
export function KSubsetCount(n: number, k: number): number {
  return Binomial(n, k);
}
/** rank-th k-subset of [n] in colex order: r = Σ_i C(c_i, i) with c_k > … > c_1 (0-based indices). Ascending 1-based out. */
export function KSubsetUnrank(n: number, k: number, rank: number): number[] {
  const total = KSubsetCount(n, k);
  if (total <= 0) return [];
  let r = modRank(rank, total);
  const idx: number[] = []; // 0-based descending
  for (let i = k; i >= 1; i--) {
    let c = i - 1;
    while (Binomial(c + 1, i) <= r) c++;
    idx.push(c);
    r -= Binomial(c, i);
  }
  idx.reverse();
  return idx.map((c) => c + 1); // ascending, 1-based
}
/** k-subset (ascending 1-based) → its colex rank. */
export function KSubsetRank(s: number[]): number {
  const idx = [...s].map((x) => x - 1); // 0-based ascending
  idx.sort((a, b) => a - b);
  let r = 0;
  for (let i = 0; i < idx.length; i++) r += Binomial(idx[i], i + 1);
  return r;
}

// ─── Tuples(n,k): k-tuples over the alphabet [n] (repeats allowed). Order = lexicographic (pos 0 = MSB). ──
// ─── more counting primitives ───────────────────────────────────────────────────────────────────────────

/** CatalanNumber(n) = C(2n,n)/(n+1), by C(i+1) = C(i)·2(2i+1)/(i+2): exact while a safe integer. */
export function CatalanNumber(n: number): number {
  if (n < 0) return 0;
  let c = 1;
  for (let i = 0; i < n; i++) c = mulDiv(c, 2 * (2 * i + 1), i + 2);
  return c;
}

// ─── CompositionsIntoKParts(n,k): k POSITIVE parts summing to n. Count C(n-1,k-1) (cut-gap subsets). ─────
// ─── WeakCompositions(n,k): k NON-NEGATIVE parts summing to n. Count C(n+k-1,k-1). ──────────────────────
// ─── Multisets(n,k): k-multisets of [n] (combinations with repetition). Count C(n+k-1,k). ──────────────
// ─── LatticePaths(a,b): monotone NE lattice paths in an a×b grid. Count C(a+b,a). Step seq 0/1 (1 = N). ──
// ─── KPermutations(n,k): k-permutations (arrangements) of [n]. Count n!/(n-k)!. ──────────────────────────
// ─── SignedPermutations(n): hyperoctahedral group B_n. Count 2^n · n!. Element = perm with ± signs. ─────
// ─── ColoredPermutations(n,k): k^n · n!. Element = [image, colors], colors in 0..k-1. ──────────────────
// ─── DyckPaths(n): balanced up/down paths of semilength n (1 = up, 0 = down). Count CatalanNumber(n). ─────────
const _dyckMemo = new Map<string, number>();
// #ways to complete a path with `s` steps remaining from height `h`, staying ≥ 0 and ending at 0.
function dyckCompletions(s: number, h: number): number {
  if (h < 0 || h > s) return 0;
  if (s === 0) return h === 0 ? 1 : 0;
  const key = `${s},${h}`;
  let v = _dyckMemo.get(key);
  if (v === undefined) {
    v = dyckCompletions(s - 1, h + 1) + (h > 0 ? dyckCompletions(s - 1, h - 1) : 0);
    _dyckMemo.set(key, v);
  }
  return v;
}

/** rank-th Dyck path of semilength n, up-before-down order. */
export function DyckPathUnrank(n: number, rank: number): number[] {
  const total = CatalanNumber(n);
  let r = total ? modRank(rank, total) : 0;
  const out: number[] = [];
  let h = 0;
  for (let s = 2 * n; s > 0; s--) {
    const up = dyckCompletions(s - 1, h + 1);
    if (r < up) {
      out.push(1);
      h++;
    } else {
      r -= up;
      out.push(0);
      h--;
    }
  }
  return out;
}
export function DyckPathRank(path: number[]): number {
  let r = 0,
    h = 0;
  for (let i = 0; i < path.length; i++) {
    const s = path.length - i;
    if (path[i] === 1) h++;
    else {
      r += dyckCompletions(s - 1, h + 1);
      h--;
    }
  }
  return r;
}

// ─── LabeledTrees(n): labeled trees on [n] via the Prüfer bijection. Count n^(n-2). Element = edge list. ──

/** Prüfer sequence (length n-2 over [n]) → the tree's edge list, edges as [min,max], caller order.
 *  Exported for LabeledTree's PruferSequence conversion (trees/src/prufer-conversion.ts). */
export function pruferDecode(seq: number[], n: number): number[][] {
  if (n === 1) return [];
  const deg = Array.from({ length: n + 1 }, () => 1);
  for (const x of seq) deg[x]++;
  const edges: number[][] = [];
  for (const x of seq) {
    let leaf = -1;
    for (let v = 1; v <= n; v++)
      if (deg[v] === 1) {
        leaf = v;
        break;
      }
    edges.push([Math.min(leaf, x), Math.max(leaf, x)]);
    deg[leaf]--;
    deg[x]--;
  }
  const rem: number[] = [];
  for (let v = 1; v <= n; v++) if (deg[v] === 1) rem.push(v);
  edges.push([Math.min(rem[0], rem[1]), Math.max(rem[0], rem[1])]);
  return edges;
}

// ─── Involutions(n): self-inverse permutations (σ²=id). Count = telephone numbers T(n). ───────────────────
const _telephone: number[] = [1, 1];
function telephone(n: number): number {
  for (let i = _telephone.length; i <= n; i++) _telephone[i] = _telephone[i - 1] + (i - 1) * _telephone[i - 2];
  return _telephone[n];
}
export function InvolutionCount(n: number): number {
  return n < 0 ? 0 : telephone(n);
}
export function InvolutionUnrank(n: number, rank: number): number[] {
  const result = Array.from({ length: n + 1 }, () => 0);
  const rec = (labels: number[], r: number): void => {
    const m = labels.length;
    if (m === 0) return;
    if (m === 1) {
      result[labels[0]] = labels[0];
      return;
    }
    const last = labels[m - 1];
    const fixed = telephone(m - 1);
    if (r < fixed) {
      result[last] = last;
      rec(labels.slice(0, m - 1), r);
      return;
    }
    r -= fixed;
    const block = telephone(m - 2);
    const j = floorDiv(r, block);
    const partner = labels[j];
    result[last] = partner;
    result[partner] = last;
    rec(
      labels.filter((x) => x !== last && x !== partner),
      r % block,
    );
  };
  const total = InvolutionCount(n);
  rec(
    Array.from({ length: n }, (_, i) => i + 1),
    total ? modRank(rank, total) : 0,
  );
  return result.slice(1);
}
export function InvolutionRank(image: number[]): number {
  const n = image.length;
  const rec = (labels: number[]): number => {
    const m = labels.length;
    if (m <= 1) return 0;
    const last = labels[m - 1];
    if (image[last - 1] === last) return rec(labels.slice(0, m - 1));
    const partner = image[last - 1];
    const j = labels.indexOf(partner);
    return telephone(m - 1) + j * telephone(m - 2) + rec(labels.filter((x) => x !== last && x !== partner));
  };
  return rec(Array.from({ length: n }, (_, i) => i + 1));
}
export function IsInvolutionOf(image: number[], n: number): boolean {
  if (!Array.isArray(image) || image.length !== n) return false;
  const seen = Array.from({ length: n + 1 }, () => false);
  for (const x of image) {
    if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
    seen[x] = true;
  }
  for (let i = 1; i <= n; i++) if (image[image[i - 1] - 1] !== i) return false; // σ(σ(i)) = i
  return true;
}

// ─── MotzkinPaths(n): length-n paths, steps U(+1)/L(0)/D(-1), stay ≥0, end at 0. Count Motzkin M(n). ─────
// ─── FibonacciWords(n): 0/1 strings of length n with no two consecutive 1s. Count Fibonacci(n+2). ────────
// fibComp(m, last) = #valid suffixes of length m given previous bit `last`: the Fibonacci
// numbers 1, 2, 3, 5, … after a 0, and the one before after a 1 (which allows only a 0 next).
// ─── GrayCodeSubsets(n): the subsets of [n] in binary-reflected Gray-code order (consecutive differ by one). ─
// ─── BinaryTrees(n): binary trees with n internal nodes (CatalanNumber). Element nested: leaf 0, node [L,R]. ─────
export type BinTree = 0 | [BinTree, BinTree];

export function BinaryTreeUnrank(n: number, rank: number): BinTree {
  if (n === 0) return 0;
  const total = CatalanNumber(n);
  let r = total ? modRank(rank, total) : 0;
  for (let i = 0; i < n; i++) {
    const cl = CatalanNumber(i),
      cr = CatalanNumber(n - 1 - i);
    const block = cl * cr;
    if (r < block) return [BinaryTreeUnrank(i, floorDiv(r, cr)), BinaryTreeUnrank(n - 1 - i, r % cr)];
    r -= block;
  }
  return 0; // unreachable
}
function binTreeSize(t: BinTree): number {
  return t === 0 ? 0 : 1 + binTreeSize(t[0]) + binTreeSize(t[1]);
}
export function BinaryTreeRank(t: BinTree): number {
  if (t === 0) return 0;
  const n = binTreeSize(t);
  const li = binTreeSize(t[0]);
  let base = 0;
  for (let i = 0; i < li; i++) base += CatalanNumber(i) * CatalanNumber(n - 1 - i);
  const cr = CatalanNumber(n - 1 - li);
  return base + BinaryTreeRank(t[0]) * cr + BinaryTreeRank(t[1]);
}
export function IsBinaryTree(t: unknown, n: number): boolean {
  const ok = (x: unknown): boolean => x === 0 || (Array.isArray(x) && x.length === 2 && ok(x[0]) && ok(x[1]));
  return ok(t) && binTreeSize(t as BinTree) === n;
}

// ─── BinaryTreeParentArrays(n): the same trees, each as its in-order parent array (entry k is the
// parent of the k-th node in order, 0 at the root). Listed in BinaryTrees' order. The domains
// area's maps (../../domains/src/binary-tree.ts) reuse these two functions directly, adding only
// the MathJSON encode/decode boundary a map kernel runs over. ─────
// ─── Derangements(n): permutations with no fixed point. Count = subfactorial D(n). ──────────────────────
const _subfac: number[] = [1, 0];
function subfactorial(n: number): number {
  for (let i = _subfac.length; i <= n; i++) _subfac[i] = (i - 1) * (_subfac[i - 1] + _subfac[i - 2]);
  return _subfac[n];
}
export function DerangementCount(n: number): number {
  return n < 0 ? 0 : subfactorial(n);
}
// build a derangement on the sorted label set S (as a Map label→image)
function derangeRec(S: number[], r: number, sigma: Map<number, number>): void {
  const s = S.length;
  if (s === 0) return;
  const m = S[s - 1]; // largest label
  const others = S.slice(0, s - 1);
  const dA = subfactorial(s - 2); // 2-cycle case
  const dB = subfactorial(s - 1); // p not paired back
  const per = dA + dB;
  const pIdx = floorDiv(r, per);
  let rem = r % per;
  const p = others[pIdx];
  if (rem < dA) {
    sigma.set(m, p);
    sigma.set(p, m);
    derangeRec(
      S.filter((x) => x !== m && x !== p),
      rem,
      sigma,
    );
  } else {
    rem -= dA;
    const sub = S.slice(0, s - 1); // S \ {m}
    derangeRec(sub, rem, sigma); // τ on S\{m}
    // redirect: y with τ(y)=p now maps to m; and m maps to p
    let y = -1;
    for (const x of sub)
      if (sigma.get(x) === p) {
        y = x;
        break;
      }
    sigma.set(m, p);
    sigma.set(y, m);
  }
}
export function DerangementUnrank(n: number, rank: number): number[] {
  const total = DerangementCount(n);
  if (total <= 0) return n === 0 ? [] : [];
  const sigma = new Map<number, number>();
  derangeRec(
    Array.from({ length: n }, (_, i) => i + 1),
    modRank(rank, total),
    sigma,
  );
  return Array.from({ length: n }, (_, i) => sigma.get(i + 1)!);
}
export function DerangementRank(image: number[]): number {
  const n = image.length;
  const rankRec = (S: number[], sig: Map<number, number>): number => {
    const s = S.length;
    if (s === 0) return 0;
    const m = S[s - 1];
    const others = S.slice(0, s - 1);
    const dA = subfactorial(s - 2),
      dB = subfactorial(s - 1);
    const p = sig.get(m)!;
    const pIdx = others.indexOf(p);
    let base = pIdx * (dA + dB);
    if (sig.get(p) === m) {
      // 2-cycle case A
      return (
        base +
        rankRec(
          S.filter((x) => x !== m && x !== p),
          sig,
        )
      );
    }
    // case B: reconstruct τ on S\{m}: y (=sig^{-1}(m)) maps to p in τ
    base += dA;
    let y = -1;
    for (const x of others)
      if (sig.get(x) === m) {
        y = x;
        break;
      }
    const tau = new Map(sig);
    tau.delete(m);
    tau.set(y, p);
    return base + rankRec(S.slice(0, s - 1), tau);
  };
  const sig = new Map<number, number>();
  image.forEach((v, i) => sig.set(i + 1, v));
  return rankRec(
    Array.from({ length: n }, (_, i) => i + 1),
    sig,
  );
}
export function IsDerangementOf(image: number[], n: number): boolean {
  if (!Array.isArray(image) || image.length !== n) return false;
  const seen = Array.from({ length: n + 1 }, () => false);
  for (let i = 0; i < n; i++) {
    const x = image[i];
    if (!Number.isInteger(x) || x < 1 || x > n || seen[x] || x === i + 1) return false;
    seen[x] = true;
  }
  return true;
}

// ─── DistinctPartitions(n): integer partitions into DISTINCT parts. Count q(n). ─────────────────────────
const _distMemo = new Map<string, number>();
function distinctParts(m: number, maxp: number): number {
  if (m === 0) return 1;
  if (m < 0 || maxp <= 0) return 0;
  const key = `${m},${maxp}`;
  let v = _distMemo.get(key);
  if (v === undefined) {
    v = distinctParts(m, maxp - 1) + distinctParts(m - maxp, maxp - 1);
    _distMemo.set(key, v);
  }
  return v;
}
export function PartitionsQ(n: number): number {
  return n < 0 ? 0 : distinctParts(n, n);
}
export function DistinctPartitionUnrank(n: number, rank: number): number[] {
  const total = PartitionsQ(n);
  let r = total ? modRank(rank, total) : 0;
  const out: number[] = [];
  let m = n,
    upper = n;
  while (m > 0) {
    for (let part = Math.min(m, upper); part >= 1; part--) {
      const c = distinctParts(m - part, part - 1);
      if (r < c) {
        out.push(part);
        m -= part;
        upper = part - 1;
        break;
      }
      r -= c;
    }
  }
  return out;
}
export function DistinctPartitionRank(p: number[], n: number): number {
  const parts = [...p];
  parts.sort((a, b) => b - a);
  let r = 0,
    m = n,
    upper = n;
  for (const part of parts) {
    for (let v = Math.min(m, upper); v > part; v--) r += distinctParts(m - v, v - 1);
    m -= part;
    upper = part - 1;
  }
  return r;
}
export function IsDistinctPartitionOf(p: number[], n: number): boolean {
  if (!Array.isArray(p)) return false;
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    // Parts strictly decreasing, so none repeats.
    if (!Number.isInteger(p[i]) || p[i] < 1 || (i > 0 && p[i - 1] <= p[i])) return false;
    s += p[i];
  }
  return s === n;
}

// ─── PartitionsInBox(a,b): partitions with ≤ a parts, each ≤ b. Count C(a+b,a) (lattice-path bijection). ─
// ─── SchröderPaths(n): large Schröder paths — steps U(+1,w1), D(-1,w1), L(level,w2), width 2n, ≥0, end 0. ─
// Tokens: U = 1, L = 2, D = -1. Count = large Schröder number r(n) (2, 6, 22, 90, …).
// ─── OrderedTrees(n): plane (ordered) trees with n edges (CatalanNumber(n)) via the Dyck bijection. ────────────
// Element is nested: a node = the list of its child subtrees; a leaf = the empty list.
export type OrdTree = OrdTree[];
export function OrderedTreeCount(n: number): number {
  return CatalanNumber(n);
}
function dyckToForest(path: number[]): { forest: OrdTree[]; pos: number } {
  const forest: OrdTree[] = [];
  let pos = 0;
  const build = (): OrdTree => {
    const children: OrdTree[] = [];
    while (pos < path.length && path[pos] === 1) {
      pos++;
      children.push(build());
      pos++; /* matching 0 */
    }
    return children;
  };
  while (pos < path.length && path[pos] === 1) {
    pos++;
    forest.push(build());
    pos++;
  }
  return { forest, pos };
}
/** rank-th plane tree with n edges: unrank a Dyck path of semilength n, read it as a single rooted tree. */
export function OrderedTreeUnrank(n: number, rank: number): OrdTree {
  const path = DyckPathUnrank(n, rank);
  return dyckToForest(path).forest; // the root's children (root itself carries no edge)
}
function forestToDyck(children: OrdTree[], out: number[]): void {
  for (const child of children) {
    out.push(1);
    forestToDyck(child, out);
    out.push(0);
  }
}
export function OrderedTreeRank(tree: OrdTree): number {
  const path: number[] = [];
  forestToDyck(tree, path);
  return DyckPathRank(path);
}
function ordTreeEdges(t: unknown): number {
  if (!Array.isArray(t)) return NaN;
  let e = 0;
  for (const c of t) {
    e += 1 + ordTreeEdges(c);
  }
  return e;
}
export function IsOrderedTree(t: unknown, n: number): boolean {
  const wellFormed = (x: unknown): boolean => Array.isArray(x) && x.every(wellFormed);
  return wellFormed(t) && ordTreeEdges(t) === n;
}

// ─── KAryTrees(n,k): k-ary trees with n internal nodes (Fuss–CatalanNumber). Element nested: leaf 0, node [c1..ck]. ─
export type KTree = 0 | KTree[];
const _fillMemo = new Map<string, number>();
function karyTreeCount0(s: number, k: number): number {
  return s === 0 ? 1 : cntFill(s - 1, k, k);
}
function cntFill(m: number, slots: number, k: number): number {
  if (slots === 0) return m === 0 ? 1 : 0;
  if (m < 0) return 0;
  const key = `${m},${slots},${k}`;
  let v = _fillMemo.get(key);
  if (v === undefined) {
    v = 0;
    for (let s = 0; s <= m; s++) v += karyTreeCount0(s, k) * cntFill(m - s, slots - 1, k);
    _fillMemo.set(key, v);
  }
  return v;
}
export function KAryTreeCount(n: number, k: number): number {
  if (n < 0 || k < 1) return 0;
  return karyTreeCount0(n, k);
}
function kSize(t: KTree): number {
  if (t === 0) return 0;
  let s = 0;
  for (const c of t) s += kSize(c);
  return 1 + s;
}
function unrankForest(m: number, slots: number, k: number, r: number): KTree[] {
  if (slots === 0) return [];
  for (let s = 0; s <= m; s++) {
    const cc = karyTreeCount0(s, k),
      rc = cntFill(m - s, slots - 1, k);
    const block = cc * rc;
    if (r < block) return [unrankKTree(s, k, floorDiv(r, rc)), ...unrankForest(m - s, slots - 1, k, r % rc)];
    r -= block;
  }
  return [];
}
function unrankKTree(n: number, k: number, r: number): KTree {
  if (n === 0) return 0;
  return unrankForest(n - 1, k, k, r);
}
export function KAryTreeUnrank(n: number, k: number, rank: number): KTree {
  const total = KAryTreeCount(n, k);
  return unrankKTree(n, k, total ? modRank(rank, total) : 0);
}
function rankForest(children: KTree[], k: number): number {
  let r = 0;
  let m = 0;
  for (const c of children) m += kSize(c);
  const slots = children.length;
  for (let idx = 0; idx < children.length; idx++) {
    const s = kSize(children[idx]);
    const restSlots = slots - 1 - idx;
    for (let sp = 0; sp < s; sp++) r += karyTreeCount0(sp, k) * cntFill(m - sp, restSlots, k);
    r += rankKTree(children[idx], k) * cntFill(m - s, restSlots, k);
    m -= s;
  }
  return r;
}
function rankKTree(t: KTree, k: number): number {
  return t === 0 ? 0 : rankForest(t, k);
}
export function KAryTreeRank(t: KTree, k: number): number {
  return rankKTree(t, k);
}
export function IsKAryTree(t: unknown, n: number, k: number): boolean {
  const ok = (x: unknown): boolean => x === 0 || (Array.isArray(x) && x.length === k && x.every(ok));
  return k >= 1 && ok(t) && kSize(t as KTree) === n;
}

// ─── Surjections(n,k): surjective functions [n] ↠ [k] (every value 1..k hit). Count k!·S(n,k). ──────────
// #ways to fill `remaining` positions over alphabet 1..k with `missing` still-unused values to place.
// ─── BinaryStrings(n): 0/1 strings of length n. Count 2^n. (Position 0 is most significant.) ─────────────
// ─── CyclicPermutations(n): permutations that are a single n-cycle. Count (n-1)!. ───────────────────────
export function CyclicPermutationCount(n: number): number {
  return n < 1 ? 0 : Factorial(n - 1);
}
export function CyclicPermutationUnrank(n: number, rank: number): number[] {
  if (n === 0) return [];
  if (n === 1) return [1];
  const p = PermutationUnrank(n - 1, rank); // arrangement of the other n-1 elements after 1
  const cycle = [1, ...p.map((x) => x + 1)];
  const image: number[] = Array.from({ length: n }, () => 0);
  for (let i = 0; i < n; i++) image[cycle[i] - 1] = cycle[(i + 1) % n];
  return image;
}
export function CyclicPermutationRank(image: number[]): number {
  const n = image.length;
  if (n <= 1) return 0;
  const cycle = [1];
  let cur = image[0];
  while (cur !== 1) {
    cycle.push(cur);
    cur = image[cur - 1];
  }
  return PermutationRank(cycle.slice(1).map((x) => x - 1));
}
export function IsCyclicPermutationOf(image: number[], n: number): boolean {
  if (!Array.isArray(image) || image.length !== n) return false;
  const seen = Array.from({ length: n + 1 }, () => false);
  for (const x of image) {
    if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
    seen[x] = true;
  }
  if (n === 0) return true;
  let cur = 1,
    steps = 0;
  do {
    cur = image[cur - 1];
    steps++;
  } while (cur !== 1 && steps <= n);
  return steps === n; // one full n-cycle
}

// ─── PerfectMatchings(n): perfect matchings of [2n] (pairings). Count (2n-1)!! (double factorial). ───────
// ─── PartitionsMaxPart(n,m): integer partitions of n with every part ≤ m. Count = partsAtMost(n,m). ──────
const _pamX = new Map<string, number>();
function partsLeq(m: number, j: number): number {
  if (m === 0) return 1;
  if (m < 0 || j <= 0) return 0;
  const key = `${m},${j}`;
  let v = _pamX.get(key);
  if (v === undefined) {
    v = partsLeq(m, j - 1) + partsLeq(m - j, j);
    _pamX.set(key, v);
  }
  return v;
}
export function PartitionsMaxPartCount(n: number, m: number): number {
  return n < 0 ? 0 : partsLeq(n, m);
}
export function PartitionsMaxPartUnrank(n: number, m: number, rank: number): number[] {
  const total = PartitionsMaxPartCount(n, m);
  let r = total ? modRank(rank, total) : 0;
  const out: number[] = [];
  let rem = n,
    cap = m;
  while (rem > 0) {
    for (let part = Math.min(rem, cap); part >= 1; part--) {
      const c = partsLeq(rem - part, part);
      if (r < c) {
        out.push(part);
        rem -= part;
        cap = part;
        break;
      }
      r -= c;
    }
  }
  return out;
}
export function PartitionsMaxPartRank(p: number[], m: number): number {
  const parts = [...p];
  parts.sort((a, b) => b - a);
  const n = parts.reduce((a, b) => a + b, 0);
  let r = 0,
    rem = n,
    cap = m;
  for (const part of parts) {
    for (let v = Math.min(rem, cap); v > part; v--) r += partsLeq(rem - v, v);
    rem -= part;
    cap = part;
  }
  return r;
}
export function IsPartitionMaxPart(p: number[], n: number, m: number): boolean {
  if (!Array.isArray(p)) return false;
  let s = 0,
    prev = Infinity;
  for (const x of p) {
    if (!Number.isInteger(x) || x < 1 || x > m || x > prev) return false;
    s += x;
    prev = x;
  }
  return s === n;
}

// ─── RootedForests(n): rooted forests on [n] via labeled trees on [n+1]. Count (n+1)^(n-1). ─────────────
// Element = a parent array of length n: parent[i-1] is i's parent, or 0 if i is a tree root.
// ─── PolygonalNumber(r, n): the n-th r-gonal number. Wolfram: PolygonalNumber[n] = triangular (r=3),
//     PolygonalNumber[r, n] = ((r-2)n² − (r-4)n)/2. ────────────────────────────────────────────────────────
export function PolygonalNumber(r: number, n: number): number {
  return ((r - 2) * n * n - (r - 4) * n) / 2;
}

// ─── digit functions (Wolfram IntegerDigits / FromDigits / RealDigits, exact-integer core) ──────────────
/** Base-`base` digits of a non-negative integer, most-significant first. `len`: left-pad with 0s, or keep
 *  the last `len` digits (Wolfram IntegerDigits[n, b, len]). */
export function IntegerDigitsKernel(n: number, base = 10, len?: number): number[] {
  let m = Math.abs(Math.trunc(n));
  const b = base >= 2 ? Math.trunc(base) : 10;
  const out: number[] = [];
  if (m === 0) out.push(0);
  while (m > 0) {
    out.unshift(m % b);
    m = Math.floor(m / b);
  }
  if (len !== undefined) {
    if (out.length < len) while (out.length < len) out.unshift(0);
    else if (out.length > len) return out.slice(out.length - len);
  }
  return out;
}
/** Integer from its base-`base` digit list (most-significant first). Inverse of IntegerDigitsKernel. */
export function FromDigitsKernel(digits: number[], base = 10): number {
  const b = base >= 2 ? Math.trunc(base) : 10;
  let r = 0;
  for (const d of digits) r = r * b + d;
  return r;
}

// ─── more integer ops CE lacks (Wolfram-named; the ones CE HAS — Abs/Floor/Mod/GCD/Divisors/Totient/… — we
//     bind to rather than reimplement). ────────────────────────────────────────────────────────────────────
// Double factorial (Wolfram Factorial2): n!! = n·(n−2)·(n−4)·…, down to 1 (odd n) or 2 (even n); (−1)!! = 0!! = 1.
export function Factorial2(n: number): number {
  let r = 1;
  for (let k = n; k > 1; k -= 2) r *= k;
  return r;
}
