// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.

import { Binomial } from "../../../collections/src/families/kernels-combinatorics.ts";
import {
  CatalanNumber,
  KSubsetRank,
  KSubsetUnrank,
  pruferDecode,
  type BinTree,
} from "../../../collections/src/families/kernels-extra.ts";
import {
  Factorial,
  PermutationRank,
  PermutationUnrank,
  bitOf,
  floorDiv,
  highWord,
  joinWords,
  lowWord,
  modRank,
  wordsOfBits,
} from "../../../collections/src/families/kernels.ts";
import { CountSurjections } from "./collections-kernels-combinatorics.ts";
import { grayWords, ipow, ungrayWords } from "./collections-kernels.ts";

// ─── FibonacciWords(n): 0/1 strings of length n with no two consecutive 1s. Count Fibonacci(n+2). ────────
// fibComp(m, last) = #valid suffixes of length m given previous bit `last`: the Fibonacci
// numbers 1, 2, 3, 5, … after a 0, and the one before after a 1 (which allows only a 0 next).
export const fibFree: number[] = [1, 2];

export function fibComp(m: number, last: number): number {
  if (m === 0) return 1;
  while (fibFree.length <= m) fibFree.push(fibFree[fibFree.length - 1] + fibFree[fibFree.length - 2]);
  return last === 1 ? fibFree[m - 1] : fibFree[m];
}

export function FibonacciWordRank(word: number[]): number {
  let r = 0;
  for (let i = 0; i < word.length; i++) if (word[i] === 1) r += fibComp(word.length - i - 1, 0);
  return r;
}

export function FibonacciWordCount(n: number): number {
  return fibComp(n, 0);
}

export function FibonacciWordUnrank(n: number, rank: number): number[] {
  const total = FibonacciWordCount(n);
  let r = total ? modRank(rank, total) : 0;
  const out: number[] = [];
  let last = 0;
  for (let i = 0; i < n; i++) {
    const zero = fibComp(n - i - 1, 0); // place a 0
    if (r < zero) {
      out.push(0);
      last = 0;
      continue;
    }
    r -= zero;
    out.push(1);
    last = 1; // place a 1 (only allowed if last !== 1, guaranteed by the count split)
    void last;
  }
  return out;
}

export function IsFibonacciWord(word: number[], n: number): boolean {
  if (!Array.isArray(word) || word.length !== n) return false;
  for (let i = 0; i < n; i++) {
    if (word[i] !== 0 && word[i] !== 1) return false;
    if (i > 0 && word[i] === 1 && word[i - 1] === 1) return false;
  }
  return true;
}

export function IsTupleOf(t: number[], n: number, k: number): boolean {
  if (!Array.isArray(t) || t.length !== k) return false;
  for (const x of t) if (!Number.isInteger(x) || x < 1 || x > n) return false;
  return true;
}

/** k-tuple over [n] → its lex rank. */
export function TupleRank(t: number[], n: number): number {
  let r = 0;
  for (const x of t) r = r * n + (x - 1);
  return r;
}

// ─── Tuples(n,k): k-tuples over the alphabet [n] (repeats allowed). Order = lexicographic (pos 0 = MSB). ──
export function TupleCount(n: number, k: number): number {
  return ipow(n, k);
}

/** rank-th k-tuple over [n]: base-n digits, position 0 most significant, entries 1..n. */
export function TupleUnrank(n: number, k: number, rank: number): number[] {
  const total = TupleCount(n, k);
  let r = total ? modRank(rank, total) : 0;
  const out: number[] = Array.from({ length: k }, () => 0);
  for (let i = k - 1; i >= 0; i--) {
    out[i] = (r % n) + 1;
    r = floorDiv(r, n);
  }
  return out;
}

export function IsBinaryString(w: number[], n: number): boolean {
  if (!Array.isArray(w) || w.length !== n) return false;
  for (const b of w) if (b !== 0 && b !== 1) return false;
  return true;
}

export function BinaryStringRank(w: number[]): number {
  let r = 0;
  for (const b of w) r = r * 2 + b;
  return r;
}

export function BinaryStringUnrank(n: number, rank: number): number[] {
  const N = 2 ** n;
  const R = N ? modRank(rank, N) : 0;
  const hi = highWord(R);
  const lo = lowWord(R, hi);
  const out: number[] = Array.from({ length: n }, () => 0);
  for (let i = 0; i < n; i++) out[i] = bitOf(lo, hi, n - 1 - i);
  return out;
}

// ─── BinaryStrings(n): 0/1 strings of length n. Count 2^n. (Position 0 is most significant.) ─────────────
export function BinaryStringCount(n: number): number {
  return 2 ** n;
}

// ─── BinaryTreeParentArrays(n): the same trees, each as its in-order parent array (entry k is the
// parent of the k-th node in order, 0 at the root). Listed in BinaryTrees' order. The domains
// area's maps (../../domains/src/binary-tree.ts) reuse these two functions directly, adding only
// the MathJSON encode/decode boundary a map kernel runs over. ─────
export function BinaryTreeParentArray(t: BinTree): number[] {
  const parents: number[] = [];
  let next = 1;
  const walk = (x: BinTree): number => {
    if (x === 0) return 0;
    const left = walk(x[0]);
    const me = next++;
    const right = walk(x[1]);
    if (left !== 0) parents[left - 1] = me;
    if (right !== 0) parents[right - 1] = me;
    return me;
  };
  const root = walk(t);
  if (root !== 0) parents[root - 1] = 0;
  return parents;
}

/** The tree an in-order parent array describes; undefined when it describes none. */
export function BinaryTreeOfParentArray(parents: readonly number[]): BinTree | undefined {
  const n = parents.length;
  const left = Array.from({ length: n + 1 }, () => 0);
  const right = Array.from({ length: n + 1 }, () => 0);
  let root = 0;
  for (let v = 1; v <= n; v++) {
    const p = parents[v - 1]!;
    if (!Number.isInteger(p) || p < 0 || p > n || p === v) return undefined;
    const side = v < p ? left : right;
    if (p === 0) {
      if (root !== 0) return undefined;
      root = v;
    } else if (side[p] !== 0) return undefined;
    else side[p] = v;
  }
  const build = (v: number, depth: number): BinTree | undefined => {
    if (v === 0) return 0;
    if (depth > n) return undefined;
    const l = build(left[v]!, depth + 1);
    const r = build(right[v]!, depth + 1);
    return l === undefined || r === undefined ? undefined : [l, r];
  };
  const tree = n === 0 ? 0 : build(root, 0);
  if (tree === undefined) return undefined;
  const back = BinaryTreeParentArray(tree);
  return back.length === n && back.every((p, i) => p === parents[i]) ? tree : undefined;
}

export function IsBinaryTreeParentArray(a: unknown, n: number): boolean {
  return Array.isArray(a) && a.length === n && BinaryTreeOfParentArray(a as number[]) !== undefined;
}

export function BinaryTreeCount(n: number): number {
  return CatalanNumber(n);
}

/** Edge list → its Prüfer sequence (the inverse of pruferDecode). */
export function pruferEncode(edges: number[][], n: number): number[] {
  if (n <= 2) return [];
  const adj = Array.from({ length: n + 1 }, () => [] as number[]);
  const deg = Array.from({ length: n + 1 }, () => 0);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
    deg[u]++;
    deg[v]++;
  }
  const removed = Array.from({ length: n + 1 }, () => false);
  const seq: number[] = [];
  for (let i = 0; i < n - 2; i++) {
    let leaf = -1;
    for (let v = 1; v <= n; v++)
      if (!removed[v] && deg[v] === 1) {
        leaf = v;
        break;
      }
    let nb = -1;
    for (const w of adj[leaf])
      if (!removed[w]) {
        nb = w;
        break;
      }
    seq.push(nb);
    removed[leaf] = true;
    deg[leaf]--;
    deg[nb]--;
  }
  return seq;
}

export function LabeledTreeRank(edges: number[][], n: number): number {
  if (n <= 2) return 0;
  return TupleRank(pruferEncode(edges, n), n);
}

export function RootedForestRank(parent: number[], n: number): number {
  const edges: number[][] = [];
  for (let i = 1; i <= n; i++) {
    const p = parent[i - 1];
    edges.push([i, p === 0 ? n + 1 : p]);
  }
  return LabeledTreeRank(edges, n + 1);
}

export function IsRootedForest(parent: unknown, n: number): boolean {
  if (!Array.isArray(parent) || parent.length !== n) return false;
  const uf = Array.from({ length: n + 2 }, (_, i) => i);
  const find = (x: number): number => (uf[x] === x ? x : (uf[x] = find(uf[x])));
  for (let i = 1; i <= n; i++) {
    const p = parent[i - 1];
    if (!Number.isInteger(p) || p < 0 || p > n) return false;
    const a = i,
      b = p === 0 ? n + 1 : p;
    const ra = find(a),
      rb = find(b);
    if (ra === rb) return false;
    uf[ra] = rb;
  }
  return true; // n edges on n+1 vertices, acyclic ⇒ a tree ⇒ a valid rooted forest on [n]
}

export function LabeledTreeUnrank(n: number, rank: number): number[][] {
  if (n <= 1) return [];
  if (n === 2) return [[1, 2]];
  return pruferDecode(TupleUnrank(n, n - 2, rank), n);
}

export function RootedForestUnrank(n: number, rank: number): number[] {
  if (n === 0) return [];
  const edges = LabeledTreeUnrank(n + 1, rank); // tree on {1..n+1}, root at n+1
  const root = n + 1;
  const adj: number[][] = Array.from({ length: n + 2 }, () => []);
  for (const [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }
  const parent = Array.from({ length: n }, () => 0);
  const seen = Array.from({ length: n + 2 }, () => false);
  const queue = [root];
  seen[root] = true;
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adj[cur])
      if (!seen[nb]) {
        seen[nb] = true;
        parent[nb - 1] = cur === root ? 0 : cur;
        queue.push(nb);
      }
  }
  return parent;
}

// ─── RootedForests(n): rooted forests on [n] via labeled trees on [n+1]. Count (n+1)^(n-1). ─────────────
// Element = a parent array of length n: parent[i-1] is i's parent, or 0 if i is a tree root.
export function RootedForestCount(n: number): number {
  return n <= 0 ? 1 : ipow(n + 1, n - 1);
}

export function IsLabeledTreeOf(edges: number[][], n: number): boolean {
  if (!Array.isArray(edges) || edges.length !== Math.max(0, n - 1)) return false;
  const parent = Array.from({ length: n + 1 }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const e of edges) {
    if (!Array.isArray(e) || e.length !== 2) return false;
    const [u, v] = e;
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 1 || v < 1 || u > n || v > n || u === v) return false;
    const ru = find(u),
      rv = find(v);
    if (ru === rv) return false; // a cycle — not a tree
    parent[ru] = rv;
  }
  // n-1 acyclic edges on n vertices ⇒ connected ⇒ a tree
  return true;
}

// ─── LabeledTrees(n): labeled trees on [n] via the Prüfer bijection. Count n^(n-2). Element = edge list. ──
export function LabeledTreeCount(n: number): number {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  return ipow(n, n - 2);
}

export function IsPerfectMatchingOf(pairs: unknown, n: number): boolean {
  if (!Array.isArray(pairs) || pairs.length !== n) return false;
  const seen = Array.from({ length: 2 * n + 1 }, () => false);
  for (const e of pairs) {
    if (!Array.isArray(e) || e.length !== 2) return false;
    for (const x of e) {
      if (!Number.isInteger(x) || x < 1 || x > 2 * n || seen[x]) return false;
      seen[x] = true;
    }
  }
  return true;
}

// ─── PerfectMatchings(n): perfect matchings of [2n] (pairings). Count (2n-1)!! (double factorial). ───────
export function doubleFactOdd(k: number): number {
  let f = 1;
  for (let i = k; i >= 1; i -= 2) f *= i;
  return f;
}

export function PerfectMatchingRank(pairs: number[][], n: number): number {
  // partner lookup
  const partner = Array.from({ length: 2 * n + 1 }, () => 0);
  for (const [a, b] of pairs) {
    partner[a] = b;
    partner[b] = a;
  }
  const points: number[] = Array.from({ length: 2 * n }, (_, i) => i + 1);
  let r = 0;
  while (points.length) {
    const p = points.shift()!;
    const q = partner[p];
    const j = points.indexOf(q);
    const block = doubleFactOdd(points.length - 2);
    r += j * block;
    points.splice(j, 1);
  }
  return r;
}

export function PerfectMatchingCount(n: number): number {
  return n < 0 ? 0 : doubleFactOdd(2 * n - 1);
}

/** rank-th perfect matching of [2n], as a list of [min,max] pairs ordered by least element. */
export function PerfectMatchingUnrank(n: number, rank: number): number[][] {
  const total = PerfectMatchingCount(n);
  let r = total ? modRank(rank, total) : 0;
  const points: number[] = Array.from({ length: 2 * n }, (_, i) => i + 1);
  const pairs: number[][] = [];
  while (points.length) {
    const p = points.shift()!;
    const L = points.length; // odd
    const block = doubleFactOdd(L - 2); // (L-2)!! completions after this pair (L-2 is odd)
    const j = floorDiv(r, block);
    r %= block;
    const q = points[j];
    points.splice(j, 1);
    pairs.push([p, q]);
  }
  return pairs;
}

export function IsSurjectionOf(word: number[], n: number, k: number): boolean {
  if (!Array.isArray(word) || word.length !== n) return false;
  const hit = Array.from({ length: k + 1 }, () => false);
  let cnt = 0;
  for (const x of word) {
    if (!Number.isInteger(x) || x < 1 || x > k) return false;
    if (!hit[x]) {
      hit[x] = true;
      cnt++;
    }
  }
  return cnt === k;
}

export const _surjMemo = new Map<string, number>();

// #ways to fill `remaining` positions over alphabet 1..k with `missing` still-unused values to place.
export function surjCompletions(remaining: number, missing: number, k: number): number {
  if (remaining === 0) return missing === 0 ? 1 : 0;
  if (missing > remaining) return 0;
  const key = `${remaining},${missing},${k}`;
  let v = _surjMemo.get(key);
  if (v === undefined) {
    v =
      missing * surjCompletions(remaining - 1, missing - 1, k) +
      (k - missing) * surjCompletions(remaining - 1, missing, k);
    _surjMemo.set(key, v);
  }
  return v;
}

export function SurjectionRank(word: number[], k: number): number {
  const n = word.length;
  let r = 0;
  const used = new Set<number>();
  let missing = k;
  for (let i = 0; i < n; i++) {
    const label = word[i];
    for (let c = 1; c < label; c++) {
      const m2 = missing - (used.has(c) ? 0 : 1);
      r += surjCompletions(n - i - 1, m2, k);
    }
    if (!used.has(label)) {
      used.add(label);
      missing--;
    }
  }
  return r;
}

export function SurjectionCount(n: number, k: number): number {
  return CountSurjections(n, k);
}

/** rank-th surjection [n] ↠ [k] as its image word (length n, over 1..k, all values used). */
export function SurjectionUnrank(n: number, k: number, rank: number): number[] {
  const total = SurjectionCount(n, k);
  if (total <= 0) return [];
  let r = modRank(rank, total);
  const out: number[] = [];
  const used = new Set<number>();
  let missing = k;
  for (let i = 0; i < n; i++) {
    for (let c = 1; c <= k; c++) {
      const m2 = missing - (used.has(c) ? 0 : 1);
      const cnt = surjCompletions(n - i - 1, m2, k);
      if (r < cnt) {
        out.push(c);
        if (!used.has(c)) {
          used.add(c);
          missing--;
        }
        break;
      }
      r -= cnt;
    }
  }
  return out;
}

export function DyckPathCount(n: number): number {
  return CatalanNumber(n);
}

export function IsColoredPermutationOf(image: number[], colors: number[], n: number, k: number): boolean {
  if (!Array.isArray(image) || !Array.isArray(colors) || image.length !== n || colors.length !== n) return false;
  const seen = Array.from({ length: n + 1 }, () => false);
  for (const x of image) {
    if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
    seen[x] = true;
  }
  for (const c of colors) if (!Number.isInteger(c) || c < 0 || c >= k) return false;
  return true;
}

export function ColoredPermutationRank(image: number[], colors: number[], k: number): number {
  const n = image.length;
  let colorNum = 0;
  for (const c of colors) colorNum = colorNum * k + c;
  return colorNum * Factorial(n) + PermutationRank(image);
}

// ─── ColoredPermutations(n,k): k^n · n!. Element = [image, colors], colors in 0..k-1. ──────────────────
export function ColoredPermutationCount(n: number, k: number): number {
  return ipow(k, n) * Factorial(n);
}

/** rank → [image[], colors[]]; colors is a base-k word of length n, image a permutation of [n]. */
export function ColoredPermutationUnrank(n: number, k: number, rank: number): [number[], number[]] {
  const nf = Factorial(n);
  const total = ColoredPermutationCount(n, k);
  let r = total ? modRank(rank, total) : 0;
  const colorNum = floorDiv(r, nf);
  const perm = PermutationUnrank(n, r % nf);
  const colors: number[] = Array.from({ length: n }, () => 0);
  let c = colorNum;
  for (let i = n - 1; i >= 0; i--) {
    colors[i] = c % k;
    c = floorDiv(c, k);
  }
  return [perm, colors];
}

export function IsSignedPermutationOf(signed: number[], n: number): boolean {
  if (!Array.isArray(signed) || signed.length !== n) return false;
  const seen = Array.from({ length: n + 1 }, () => false);
  for (const v of signed) {
    const a = Math.abs(v);
    if (!Number.isInteger(v) || v === 0 || a > n || seen[a]) return false;
    seen[a] = true;
  }
  return true;
}

export function SignedPermutationRank(signed: number[]): number {
  const n = signed.length;
  let signMask = 0;
  const perm = signed.map((v, i) => {
    if (v < 0) signMask |= 1 << i;
    return Math.abs(v);
  });
  return signMask * Factorial(n) + PermutationRank(perm);
}

// ─── SignedPermutations(n): hyperoctahedral group B_n. Count 2^n · n!. Element = perm with ± signs. ─────
export function SignedPermutationCount(n: number): number {
  return 2 ** n * Factorial(n);
}

export function SignedPermutationUnrank(n: number, rank: number): number[] {
  const nf = Factorial(n);
  const total = SignedPermutationCount(n);
  const r = total ? modRank(rank, total) : 0;
  const signMask = floorDiv(r, nf);
  const perm = PermutationUnrank(n, r % nf);
  return perm.map((v, i) => ((signMask >> i) & 1 ? -v : v));
}

export function IsKPermutationOf(perm: number[], n: number, k: number): boolean {
  if (!Array.isArray(perm) || perm.length !== k) return false;
  const seen = Array.from({ length: n + 1 }, () => false);
  for (const x of perm) {
    if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
    seen[x] = true;
  }
  return true;
}

// ─── more counting primitives ───────────────────────────────────────────────────────────────────────────

/** Falling factorial n·(n-1)···(n-k+1) = #k-permutations of [n]. */
export function FallingFactorial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let f = 1;
  for (let i = 0; i < k; i++) f *= n - i;
  return f;
}

export function KPermutationRank(perm: number[], n: number): number {
  const k = perm.length;
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  let r = 0;
  for (let pos = 0; pos < k; pos++) {
    const idx = avail.indexOf(perm[pos]);
    r += idx * FallingFactorial(n - 1 - pos, k - 1 - pos);
    avail.splice(idx, 1);
  }
  return r;
}

export function KPermutationUnrank(n: number, k: number, rank: number): number[] {
  const total = FallingFactorial(n, k);
  if (total <= 0) return [];
  let r = modRank(rank, total);
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  const res: number[] = [];
  for (let pos = 0; pos < k; pos++) {
    const f = FallingFactorial(n - 1 - pos, k - 1 - pos);
    const idx = floorDiv(r, f);
    r %= f;
    res.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return res;
}

// ─── KPermutations(n,k): k-permutations (arrangements) of [n]. Count n!/(n-k)!. ──────────────────────────
export function KPermutationCount(n: number, k: number): number {
  return FallingFactorial(n, k);
}

export function IsPartitionInBox(p: number[], a: number, b: number): boolean {
  if (!Array.isArray(p) || p.length > a) return false;
  let prev = Infinity;
  for (const x of p) {
    if (!Number.isInteger(x) || x < 1 || x > b || x > prev) return false;
    prev = x;
  }
  return true;
}

export function LatticePathRank(path: number[]): number {
  const positions: number[] = [];
  path.forEach((s, i) => {
    if (s === 1) positions.push(i + 1);
  });
  return KSubsetRank(positions);
}

export function PartitionsInBoxRank(p: number[], a: number, b: number): number {
  const parts = [...p];
  parts.sort((x, y) => y - x);
  while (parts.length < a) parts.push(0); // pad to a parts
  // reconstruct the 0/1 path: eBefore_i = b - part_i (non-decreasing since parts non-increasing)
  const path: number[] = [];
  let placedE = 0;
  for (const part of parts) {
    const eBefore = b - part;
    while (placedE < eBefore) {
      path.push(0);
      placedE++;
    }
    path.push(1);
  }
  while (placedE < b) {
    path.push(0);
    placedE++;
  }
  return LatticePathRank(path);
}

/** rank-th path: which a of the a+b steps are N (an a-subset of [a+b]); emit a 0/1 step sequence. */
export function LatticePathUnrank(a: number, b: number, rank: number): number[] {
  const nsteps = KSubsetUnrank(a + b, a, rank); // positions (1-based) that are N
  const set = new Set(nsteps);
  const out: number[] = [];
  for (let i = 1; i <= a + b; i++) out.push(set.has(i) ? 1 : 0);
  return out;
}

export function PartitionsInBoxUnrank(a: number, b: number, rank: number): number[] {
  const path = LatticePathUnrank(a, b, rank); // 0/1 steps, a ones (N)
  const parts: number[] = [];
  let eBefore = 0;
  for (const step of path) {
    if (step === 1) parts.push(b - eBefore); // an N-step: part = E's remaining after it
    else eBefore++;
  }
  return parts.filter((x) => x > 0); // drop zero parts
}

// ─── PartitionsInBox(a,b): partitions with ≤ a parts, each ≤ b. Count C(a+b,a) (lattice-path bijection). ─
export function PartitionsInBoxCount(a: number, b: number): number {
  return Binomial(a + b, a);
}

export function IsSchroederPath(tokens: number[], n: number): boolean {
  if (!Array.isArray(tokens)) return false;
  let w = 0,
    h = 0;
  for (const t of tokens) {
    if (t !== 1 && t !== 2 && t !== -1) return false;
    w += t === 2 ? 2 : 1;
    h += t === 1 ? 1 : t === -1 ? -1 : 0;
    if (h < 0) return false;
  }
  return w === 2 * n && h === 0;
}

// ─── SchröderPaths(n): large Schröder paths — steps U(+1,w1), D(-1,w1), L(level,w2), width 2n, ≥0, end 0. ─
// Tokens: U = 1, L = 2, D = -1. Count = large Schröder number r(n) (2, 6, 22, 90, …).
export const _schrMemo = new Map<string, number>();

export function schroderCompletions(w: number, h: number): number {
  if (h < 0 || h > w) return 0;
  if (w === 0) return h === 0 ? 1 : 0;
  const key = `${w},${h}`;
  let v = _schrMemo.get(key);
  if (v === undefined) {
    v =
      schroderCompletions(w - 1, h + 1) +
      (h > 0 ? schroderCompletions(w - 1, h - 1) : 0) +
      (w >= 2 ? schroderCompletions(w - 2, h) : 0);
    _schrMemo.set(key, v);
  }
  return v;
}

export function SchroederRank(tokens: number[]): number {
  let r = 0,
    w = 0,
    h = 0;
  for (const t of tokens) w += t === 2 ? 2 : 1;
  for (const t of tokens) {
    const up = schroderCompletions(w - 1, h + 1);
    const lvl = w >= 2 ? schroderCompletions(w - 2, h) : 0;
    if (t === 1) {
      h++;
      w -= 1;
    } else if (t === 2) {
      r += up;
      w -= 2;
    } else {
      r += up + lvl;
      h--;
      w -= 1;
    }
  }
  return r;
}

export function SchroederCount(n: number): number {
  return n < 0 ? 0 : schroderCompletions(2 * n, 0);
}

/** rank-th large Schröder path, steps tried U(1) then L(2) then D(-1). */
export function SchroederUnrank(n: number, rank: number): number[] {
  const total = SchroederCount(n);
  let r = total ? modRank(rank, total) : 0;
  const out: number[] = [];
  let w = 2 * n,
    h = 0;
  while (w > 0) {
    const up = schroderCompletions(w - 1, h + 1);
    if (r < up) {
      out.push(1);
      h++;
      w -= 1;
      continue;
    }
    r -= up;
    const lvl = w >= 2 ? schroderCompletions(w - 2, h) : 0;
    if (r < lvl) {
      out.push(2);
      w -= 2;
      continue;
    }
    r -= lvl;
    out.push(-1);
    h--;
    w -= 1;
  }
  return out;
}

export function IsMotzkinPath(path: number[], n: number): boolean {
  if (!Array.isArray(path) || path.length !== n) return false;
  let h = 0;
  for (const s of path) {
    if (s !== -1 && s !== 0 && s !== 1) return false;
    h += s;
    if (h < 0) return false;
  }
  return h === 0;
}

// ─── MotzkinPaths(n): length-n paths, steps U(+1)/L(0)/D(-1), stay ≥0, end at 0. Count Motzkin M(n). ─────
export const _motzMemo = new Map<string, number>();

export function motzkinCompletions(s: number, h: number): number {
  if (h < 0 || h > s) return 0;
  if (s === 0) return h === 0 ? 1 : 0;
  const key = `${s},${h}`;
  let v = _motzMemo.get(key);
  if (v === undefined) {
    v =
      motzkinCompletions(s - 1, h + 1) + motzkinCompletions(s - 1, h) + (h > 0 ? motzkinCompletions(s - 1, h - 1) : 0);
    _motzMemo.set(key, v);
  }
  return v;
}

export function MotzkinRank(path: number[]): number {
  let r = 0,
    h = 0;
  for (let i = 0; i < path.length; i++) {
    const s = path.length - i;
    const step = path[i];
    if (step === 1) {
      h++;
    } else if (step === 0) {
      r += motzkinCompletions(s - 1, h + 1);
    } else {
      r += motzkinCompletions(s - 1, h + 1) + motzkinCompletions(s - 1, h);
      h--;
    }
  }
  return r;
}

export function MotzkinCount(n: number): number {
  return n < 0 ? 0 : motzkinCompletions(n, 0);
}

/** rank-th Motzkin path, steps tried U(1) then L(0) then D(-1). */
export function MotzkinUnrank(n: number, rank: number): number[] {
  const total = MotzkinCount(n);
  let r = total ? modRank(rank, total) : 0;
  const out: number[] = [];
  let h = 0;
  for (let s = n; s > 0; s--) {
    const up = motzkinCompletions(s - 1, h + 1);
    if (r < up) {
      out.push(1);
      h++;
      continue;
    }
    r -= up;
    const lvl = motzkinCompletions(s - 1, h);
    if (r < lvl) {
      out.push(0);
      continue;
    }
    r -= lvl;
    out.push(-1);
    h--;
  }
  return out;
}

export function IsDyckPath(path: number[], n: number): boolean {
  if (!Array.isArray(path) || path.length !== 2 * n) return false;
  let h = 0;
  for (const s of path) {
    if (s !== 0 && s !== 1) return false;
    h += s === 1 ? 1 : -1;
    if (h < 0) return false;
  }
  return h === 0;
}

/** subset → its mask rank (Σ 2^(x-1)). */
export function SubsetRank(s: number[]): number {
  const [lo, hi] = wordsOfBits(s.map((x) => x - 1));
  return joinWords(lo, hi);
}

// ─── Subsets(n): the power set of [n]. Order = binary value of the membership mask. ─────────────────────
export function SubsetCount(n: number): number {
  return 2 ** n;
}

/** rank-th subset of [n]: element i is present iff bit (i-1) of rank is set; ascending. */
export function SubsetUnrank(n: number, rank: number): number[] {
  const N = SubsetCount(n);
  const r = N ? modRank(rank, N) : 0;
  const hi = highWord(r);
  const lo = lowWord(r, hi);
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (bitOf(lo, hi, i)) out.push(i + 1);
  return out;
}

export function IsWeakCompositionOf(parts: number[], n: number, k: number): boolean {
  if (!Array.isArray(parts) || parts.length !== k) return false;
  let s = 0;
  for (const p of parts) {
    if (!Number.isInteger(p) || p < 0) return false;
    s += p;
  }
  return s === n;
}

export function CompositionsIntoKPartsRank(parts: number[]): number {
  const cuts: number[] = [];
  let cum = 0;
  for (let i = 0; i < parts.length - 1; i++) {
    cum += parts[i];
    cuts.push(cum);
  }
  return KSubsetRank(cuts);
}

export function WeakCompositionRank(parts: number[]): number {
  return CompositionsIntoKPartsRank(parts.map((p) => p + 1));
}

/** rank-th composition of n into k positive parts: the (k-1) cut gaps are a (k-1)-subset of {1..n-1}. */
export function CompositionsIntoKPartsUnrank(n: number, k: number, rank: number): number[] {
  if (k <= 0) return [];
  const cuts = KSubsetUnrank(n - 1, k - 1, rank); // ascending positions in 1..n-1
  const parts: number[] = [];
  let prev = 0;
  for (const c of cuts) {
    parts.push(c - prev);
    prev = c;
  }
  parts.push(n - prev);
  return parts;
}

/** rank-th weak composition: positive composition of n+k into k parts, minus 1 from each. */
export function WeakCompositionUnrank(n: number, k: number, rank: number): number[] {
  if (k <= 0) return [];
  return CompositionsIntoKPartsUnrank(n + k, k, rank).map((p) => p - 1);
}

// ─── WeakCompositions(n,k): k NON-NEGATIVE parts summing to n. Count C(n+k-1,k-1). ──────────────────────
export function WeakCompositionCount(n: number, k: number): number {
  if (k <= 0) return n === 0 && k === 0 ? 1 : 0;
  return Binomial(n + k - 1, k - 1);
}

export function IsCompositionIntoKParts(parts: number[], n: number, k: number): boolean {
  if (!Array.isArray(parts) || parts.length !== k) return false;
  let s = 0;
  for (const p of parts) {
    if (!Number.isInteger(p) || p < 1) return false;
    s += p;
  }
  return s === n;
}

// ─── CompositionsIntoKParts(n,k): k POSITIVE parts summing to n. Count C(n-1,k-1) (cut-gap subsets). ─────
export function CompositionsIntoKPartsCount(n: number, k: number): number {
  if (k <= 0) return n === 0 && k === 0 ? 1 : 0;
  return Binomial(n - 1, k - 1);
}

export function IsLatticePathOf(path: number[], a: number, b: number): boolean {
  if (!Array.isArray(path) || path.length !== a + b) return false;
  let ups = 0;
  for (const s of path) {
    if (s !== 0 && s !== 1) return false;
    if (s === 1) ups++;
  }
  return ups === a;
}

// ─── LatticePaths(a,b): monotone NE lattice paths in an a×b grid. Count C(a+b,a). Step seq 0/1 (1 = N). ──
export function LatticePathCount(a: number, b: number): number {
  return Binomial(a + b, a);
}

export function IsMultisetOf(m: number[], n: number, k: number): boolean {
  if (!Array.isArray(m) || m.length !== k) return false;
  let prev = 1;
  for (const x of m) {
    if (!Number.isInteger(x) || x < prev || x > n) return false;
    prev = x;
  }
  return true; // requires non-decreasing (the canonical form)
}

export function MultisetRank(m: number[]): number {
  const sorted = [...m];
  sorted.sort((a, b) => a - b);
  const s = sorted.map((x, i) => x + i);
  return KSubsetRank(s);
}

/** rank-th k-multiset of [n]: k-subset s of [n+k-1], element_i = s_i - (i-1). Ascending with repeats. */
export function MultisetUnrank(n: number, k: number, rank: number): number[] {
  const s = KSubsetUnrank(n + k - 1, k, rank); // ascending 1-based
  return s.map((x, i) => x - i);
}

// ─── Multisets(n,k): k-multisets of [n] (combinations with repetition). Count C(n+k-1,k). ──────────────
export function MultisetCount(n: number, k: number): number {
  // C(n + k − 1, k) is C(−1, 0) = 1 at n = k = 0: the one empty multiset.
  if (k === 0) return 1;
  return Binomial(n + k - 1, k);
}

export function GrayCodeSubsetRank(s: number[]): number {
  const [gLo, gHi] = wordsOfBits(s.map((x) => x - 1));
  const [lo, hi] = ungrayWords(gLo, gHi);
  return joinWords(lo, hi);
}

// ─── GrayCodeSubsets(n): the subsets of [n] in binary-reflected Gray-code order (consecutive differ by one). ─
export function GrayCodeSubsetUnrank(n: number, rank: number): number[] {
  const N = 2 ** n;
  const r = N ? modRank(rank, N) : 0;
  const hi = highWord(r);
  const [gLo, gHi] = grayWords(lowWord(r, hi), hi);
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (bitOf(gLo, gHi, i)) out.push(i + 1);
  return out;
}

// ─── Subsets(n): the power set of [n]. Order = binary value of the membership mask. ─────────────────────

export function IsSubsetOf(s: number[], n: number): boolean {
  if (!Array.isArray(s)) return false;
  const seen = Array.from({ length: n + 1 }, () => false);
  for (const x of s) {
    if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
    seen[x] = true;
  }
  return true;
}
