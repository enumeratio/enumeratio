// Fresh collections with no SQL twin — authored here, certified by the package's own bijection differential
// (enumerate-all: distinct, valid, count = closed form; and Rank∘At = id). Any consistent order is correct for
// a new collection, so these pick the simplest bijection. PascalCase heads == kernel names.

import { Binomial } from "./kernels-combinatorics.js";

// ─── Subsets(n): the power set of [n]. Order = binary value of the membership mask. ─────────────────────
export function SubsetCount(n: number): number {
  return 2 ** n;
}
/** rank-th subset of [n]: element i is present iff bit (i-1) of rank is set; ascending. */
export function SubsetUnrank(n: number, rank: number): number[] {
  const N = SubsetCount(n);
  const r = N ? ((rank % N) + N) % N : 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) if ((r >> i) & 1) out.push(i + 1);
  return out;
}
/** subset → its mask rank (Σ 2^(x-1)). */
export function SubsetRank(s: number[]): number {
  let mask = 0;
  for (const x of s) mask |= 1 << (x - 1);
  return mask;
}
export function IsSubsetOf(s: number[], n: number): boolean {
  if (!Array.isArray(s)) return false;
  const seen = new Array(n + 1).fill(false);
  for (const x of s) {
    if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
    seen[x] = true;
  }
  return true;
}

// ─── KSubsets(n,k): k-subsets of [n] in colex order (the combinatorial number system). ──────────────────
export function KSubsetCount(n: number, k: number): number {
  return Binomial(n, k);
}
/** rank-th k-subset of [n], colex order: r = Σ_i C(c_i, i) with c_k > … > c_1 (0-based indices). Ascending 1-based out. */
export function KSubsetUnrank(n: number, k: number, rank: number): number[] {
  const total = KSubsetCount(n, k);
  if (total <= 0) return [];
  let r = ((rank % total) + total) % total;
  const idx: number[] = []; // 0-based descending
  for (let i = k; i >= 1; i--) {
    let c = i - 1;
    while (Binomial(c + 1, i) <= r) c++;
    idx.push(c);
    r -= Binomial(c, i);
  }
  return idx.reverse().map((c) => c + 1); // ascending, 1-based
}
/** k-subset (ascending 1-based) → its colex rank. */
export function KSubsetRank(s: number[]): number {
  const idx = [...s].map((x) => x - 1).sort((a, b) => a - b); // 0-based ascending
  let r = 0;
  for (let i = 0; i < idx.length; i++) r += Binomial(idx[i], i + 1);
  return r;
}
export function IsKSubsetOf(s: number[], n: number, k: number): boolean {
  return IsSubsetOf(s, n) && s.length === k;
}

// ─── Tuples(n,k): k-tuples over the alphabet [n] (repeats allowed). Order = lexicographic (pos 0 = MSB). ──
export function TupleCount(n: number, k: number): number {
  return n ** k;
}
/** rank-th k-tuple over [n]: base-n digits, position 0 most significant, entries 1..n. */
export function TupleUnrank(n: number, k: number, rank: number): number[] {
  const total = TupleCount(n, k);
  let r = total ? ((rank % total) + total) % total : 0;
  const out: number[] = new Array(k);
  for (let i = k - 1; i >= 0; i--) {
    out[i] = (r % n) + 1;
    r = Math.floor(r / n);
  }
  return out;
}
/** k-tuple over [n] → its lex rank. */
export function TupleRank(t: number[], n: number): number {
  let r = 0;
  for (const x of t) r = r * n + (x - 1);
  return r;
}
export function IsTupleOf(t: number[], n: number, k: number): boolean {
  if (!Array.isArray(t) || t.length !== k) return false;
  for (const x of t) if (!Number.isInteger(x) || x < 1 || x > n) return false;
  return true;
}

// ─── more counting primitives ───────────────────────────────────────────────────────────────────────────
import { Factorial, PermutationUnrank, PermutationRank } from "./kernels.js";

/** Falling factorial n·(n-1)···(n-k+1) = #k-permutations of [n]. */
export function FallingFactorial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let f = 1;
  for (let i = 0; i < k; i++) f *= n - i;
  return f;
}

/** Catalan(n) = C(2n,n)/(n+1). */
export function Catalan(n: number): number {
  if (n < 0) return 0;
  return Math.round(Binomial(2 * n, n) / (n + 1));
}

// ─── CompositionsIntoKParts(n,k): k POSITIVE parts summing to n. Count C(n-1,k-1) (cut-gap subsets). ─────
export function CompositionsIntoKPartsCount(n: number, k: number): number {
  if (k <= 0) return n === 0 && k === 0 ? 1 : 0;
  return Binomial(n - 1, k - 1);
}
/** rank-th composition of n into k positive parts: the (k-1) cut gaps are a (k-1)-subset of {1..n-1}. */
export function CompositionsIntoKPartsUnrank(n: number, k: number, rank: number): number[] {
  if (k <= 0) return [];
  const cuts = KSubsetUnrank(n - 1, k - 1, rank); // ascending positions in 1..n-1
  const parts: number[] = [];
  let prev = 0;
  for (const c of cuts) { parts.push(c - prev); prev = c; }
  parts.push(n - prev);
  return parts;
}
export function CompositionsIntoKPartsRank(parts: number[]): number {
  const cuts: number[] = [];
  let cum = 0;
  for (let i = 0; i < parts.length - 1; i++) { cum += parts[i]; cuts.push(cum); }
  return KSubsetRank(cuts);
}
export function IsCompositionIntoKParts(parts: number[], n: number, k: number): boolean {
  if (!Array.isArray(parts) || parts.length !== k) return false;
  let s = 0;
  for (const p of parts) { if (!Number.isInteger(p) || p < 1) return false; s += p; }
  return s === n;
}

// ─── WeakCompositions(n,k): k NON-NEGATIVE parts summing to n. Count C(n+k-1,k-1). ──────────────────────
export function WeakCompositionCount(n: number, k: number): number {
  if (k <= 0) return n === 0 && k === 0 ? 1 : 0;
  return Binomial(n + k - 1, k - 1);
}
/** rank-th weak composition: positive composition of n+k into k parts, minus 1 from each. */
export function WeakCompositionUnrank(n: number, k: number, rank: number): number[] {
  if (k <= 0) return [];
  return CompositionsIntoKPartsUnrank(n + k, k, rank).map((p) => p - 1);
}
export function WeakCompositionRank(parts: number[]): number {
  return CompositionsIntoKPartsRank(parts.map((p) => p + 1));
}
export function IsWeakCompositionOf(parts: number[], n: number, k: number): boolean {
  if (!Array.isArray(parts) || parts.length !== k) return false;
  let s = 0;
  for (const p of parts) { if (!Number.isInteger(p) || p < 0) return false; s += p; }
  return s === n;
}

// ─── Multisets(n,k): k-multisets of [n] (combinations with repetition). Count C(n+k-1,k). ──────────────
export function MultisetCount(n: number, k: number): number {
  return Binomial(n + k - 1, k);
}
/** rank-th k-multiset of [n]: k-subset s of [n+k-1], element_i = s_i - (i-1). Ascending with repeats. */
export function MultisetUnrank(n: number, k: number, rank: number): number[] {
  const s = KSubsetUnrank(n + k - 1, k, rank); // ascending 1-based
  return s.map((x, i) => x - i);
}
export function MultisetRank(m: number[]): number {
  const s = [...m].sort((a, b) => a - b).map((x, i) => x + i);
  return KSubsetRank(s);
}
export function IsMultisetOf(m: number[], n: number, k: number): boolean {
  if (!Array.isArray(m) || m.length !== k) return false;
  let prev = 1;
  for (const x of m) { if (!Number.isInteger(x) || x < prev || x > n) return false; prev = x; }
  return true; // requires non-decreasing (the canonical form)
}

// ─── LatticePaths(a,b): monotone NE lattice paths in an a×b grid. Count C(a+b,a). Step seq 0/1 (1 = N). ──
export function LatticePathCount(a: number, b: number): number {
  return Binomial(a + b, a);
}
/** rank-th path: which a of the a+b steps are N (an a-subset of [a+b]); emit a 0/1 step sequence. */
export function LatticePathUnrank(a: number, b: number, rank: number): number[] {
  const nsteps = KSubsetUnrank(a + b, a, rank); // positions (1-based) that are N
  const set = new Set(nsteps);
  const out: number[] = [];
  for (let i = 1; i <= a + b; i++) out.push(set.has(i) ? 1 : 0);
  return out;
}
export function LatticePathRank(path: number[]): number {
  const positions: number[] = [];
  path.forEach((s, i) => { if (s === 1) positions.push(i + 1); });
  return KSubsetRank(positions);
}
export function IsLatticePathOf(path: number[], a: number, b: number): boolean {
  if (!Array.isArray(path) || path.length !== a + b) return false;
  let ups = 0;
  for (const s of path) { if (s !== 0 && s !== 1) return false; if (s === 1) ups++; }
  return ups === a;
}

// ─── KPermutations(n,k): k-permutations (arrangements) of [n]. Count n!/(n-k)!. ──────────────────────────
export function KPermutationCount(n: number, k: number): number {
  return FallingFactorial(n, k);
}
export function KPermutationUnrank(n: number, k: number, rank: number): number[] {
  const total = FallingFactorial(n, k);
  if (total <= 0) return [];
  let r = ((rank % total) + total) % total;
  const avail = Array.from({ length: n }, (_, i) => i + 1);
  const res: number[] = [];
  for (let pos = 0; pos < k; pos++) {
    const f = FallingFactorial(n - 1 - pos, k - 1 - pos);
    const idx = Math.floor(r / f);
    r %= f;
    res.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return res;
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
export function IsKPermutationOf(perm: number[], n: number, k: number): boolean {
  if (!Array.isArray(perm) || perm.length !== k) return false;
  const seen = new Array(n + 1).fill(false);
  for (const x of perm) {
    if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
    seen[x] = true;
  }
  return true;
}

// ─── SignedPermutations(n): hyperoctahedral group B_n. Count 2^n · n!. Element = perm with ± signs. ─────
export function SignedPermutationCount(n: number): number {
  return 2 ** n * Factorial(n);
}
export function SignedPermutationUnrank(n: number, rank: number): number[] {
  const nf = Factorial(n);
  const total = SignedPermutationCount(n);
  const r = total ? ((rank % total) + total) % total : 0;
  const signMask = Math.floor(r / nf);
  const perm = PermutationUnrank(n, r % nf);
  return perm.map((v, i) => ((signMask >> i) & 1 ? -v : v));
}
export function SignedPermutationRank(signed: number[]): number {
  const n = signed.length;
  let signMask = 0;
  const perm = signed.map((v, i) => { if (v < 0) signMask |= 1 << i; return Math.abs(v); });
  return signMask * Factorial(n) + PermutationRank(perm);
}
export function IsSignedPermutationOf(signed: number[], n: number): boolean {
  if (!Array.isArray(signed) || signed.length !== n) return false;
  const seen = new Array(n + 1).fill(false);
  for (const v of signed) {
    const a = Math.abs(v);
    if (!Number.isInteger(v) || v === 0 || a > n || seen[a]) return false;
    seen[a] = true;
  }
  return true;
}

// ─── ColoredPermutations(n,k): k^n · n!. Element = [image, colors], colors in 0..k-1. ──────────────────
export function ColoredPermutationCount(n: number, k: number): number {
  return k ** n * Factorial(n);
}
/** rank → [image[], colors[]]; colors is a base-k word of length n, image a permutation of [n]. */
export function ColoredPermutationUnrank(n: number, k: number, rank: number): [number[], number[]] {
  const nf = Factorial(n);
  const total = ColoredPermutationCount(n, k);
  let r = total ? ((rank % total) + total) % total : 0;
  const colorNum = Math.floor(r / nf);
  const perm = PermutationUnrank(n, r % nf);
  const colors: number[] = new Array(n);
  let c = colorNum;
  for (let i = n - 1; i >= 0; i--) { colors[i] = c % k; c = Math.floor(c / k); }
  return [perm, colors];
}
export function ColoredPermutationRank(image: number[], colors: number[], k: number): number {
  const n = image.length;
  let colorNum = 0;
  for (const c of colors) colorNum = colorNum * k + c;
  return colorNum * Factorial(n) + PermutationRank(image);
}
export function IsColoredPermutationOf(image: number[], colors: number[], n: number, k: number): boolean {
  if (!Array.isArray(image) || !Array.isArray(colors) || image.length !== n || colors.length !== n) return false;
  const seen = new Array(n + 1).fill(false);
  for (const x of image) { if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false; seen[x] = true; }
  for (const c of colors) if (!Number.isInteger(c) || c < 0 || c >= k) return false;
  return true;
}

// ─── DyckPaths(n): balanced up/down paths of semilength n (1 = up, 0 = down). Count Catalan(n). ─────────
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
export function DyckPathCount(n: number): number {
  return Catalan(n);
}
/** rank-th Dyck path of semilength n, up-before-down order. */
export function DyckPathUnrank(n: number, rank: number): number[] {
  const total = Catalan(n);
  let r = total ? ((rank % total) + total) % total : 0;
  const out: number[] = [];
  let h = 0;
  for (let s = 2 * n; s > 0; s--) {
    const up = dyckCompletions(s - 1, h + 1);
    if (r < up) { out.push(1); h++; }
    else { r -= up; out.push(0); h--; }
  }
  return out;
}
export function DyckPathRank(path: number[]): number {
  let r = 0, h = 0;
  for (let i = 0; i < path.length; i++) {
    const s = path.length - i;
    if (path[i] === 1) h++;
    else { r += dyckCompletions(s - 1, h + 1); h--; }
  }
  return r;
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

// ─── LabeledTrees(n): labeled trees on [n] via the Prüfer bijection. Count n^(n-2). Element = edge list. ──
export function LabeledTreeCount(n: number): number {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  return n ** (n - 2);
}
/** Prüfer sequence (length n-2 over [n]) → the tree's edge list, edges as [min,max], caller order. */
function pruferDecode(seq: number[], n: number): number[][] {
  if (n === 1) return [];
  const deg = new Array(n + 1).fill(1);
  for (const x of seq) deg[x]++;
  const edges: number[][] = [];
  for (const x of seq) {
    let leaf = -1;
    for (let v = 1; v <= n; v++) if (deg[v] === 1) { leaf = v; break; }
    edges.push([Math.min(leaf, x), Math.max(leaf, x)]);
    deg[leaf]--; deg[x]--;
  }
  const rem: number[] = [];
  for (let v = 1; v <= n; v++) if (deg[v] === 1) rem.push(v);
  edges.push([Math.min(rem[0], rem[1]), Math.max(rem[0], rem[1])]);
  return edges;
}
/** Edge list → its Prüfer sequence (the inverse of pruferDecode). */
function pruferEncode(edges: number[][], n: number): number[] {
  if (n <= 2) return [];
  const adj = Array.from({ length: n + 1 }, () => [] as number[]);
  const deg = new Array(n + 1).fill(0);
  for (const [u, v] of edges) { adj[u].push(v); adj[v].push(u); deg[u]++; deg[v]++; }
  const removed = new Array(n + 1).fill(false);
  const seq: number[] = [];
  for (let i = 0; i < n - 2; i++) {
    let leaf = -1;
    for (let v = 1; v <= n; v++) if (!removed[v] && deg[v] === 1) { leaf = v; break; }
    let nb = -1;
    for (const w of adj[leaf]) if (!removed[w]) { nb = w; break; }
    seq.push(nb);
    removed[leaf] = true; deg[leaf]--; deg[nb]--;
  }
  return seq;
}
export function LabeledTreeUnrank(n: number, rank: number): number[][] {
  if (n <= 1) return [];
  if (n === 2) return [[1, 2]];
  return pruferDecode(TupleUnrank(n, n - 2, rank), n);
}
export function LabeledTreeRank(edges: number[][], n: number): number {
  if (n <= 2) return 0;
  return TupleRank(pruferEncode(edges, n), n);
}
export function IsLabeledTreeOf(edges: number[][], n: number): boolean {
  if (!Array.isArray(edges) || edges.length !== Math.max(0, n - 1)) return false;
  const parent = Array.from({ length: n + 1 }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const e of edges) {
    if (!Array.isArray(e) || e.length !== 2) return false;
    const [u, v] = e;
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 1 || v < 1 || u > n || v > n || u === v) return false;
    const ru = find(u), rv = find(v);
    if (ru === rv) return false; // a cycle — not a tree
    parent[ru] = rv;
  }
  // n-1 acyclic edges on n vertices ⇒ connected ⇒ a tree
  return true;
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
  const result = new Array(n + 1).fill(0);
  const rec = (labels: number[], r: number): void => {
    const m = labels.length;
    if (m === 0) return;
    if (m === 1) { result[labels[0]] = labels[0]; return; }
    const last = labels[m - 1];
    const fixed = telephone(m - 1);
    if (r < fixed) { result[last] = last; rec(labels.slice(0, m - 1), r); return; }
    r -= fixed;
    const block = telephone(m - 2);
    const j = Math.floor(r / block);
    const partner = labels[j];
    result[last] = partner; result[partner] = last;
    rec(labels.filter((x) => x !== last && x !== partner), r % block);
  };
  const total = InvolutionCount(n);
  rec(Array.from({ length: n }, (_, i) => i + 1), total ? ((rank % total) + total) % total : 0);
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
  const seen = new Array(n + 1).fill(false);
  for (const x of image) { if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false; seen[x] = true; }
  for (let i = 1; i <= n; i++) if (image[image[i - 1] - 1] !== i) return false; // σ(σ(i)) = i
  return true;
}

// ─── MotzkinPaths(n): length-n paths, steps U(+1)/L(0)/D(-1), stay ≥0, end at 0. Count Motzkin M(n). ─────
const _motzMemo = new Map<string, number>();
function motzkinCompletions(s: number, h: number): number {
  if (h < 0 || h > s) return 0;
  if (s === 0) return h === 0 ? 1 : 0;
  const key = `${s},${h}`;
  let v = _motzMemo.get(key);
  if (v === undefined) {
    v = motzkinCompletions(s - 1, h + 1) + motzkinCompletions(s - 1, h) + (h > 0 ? motzkinCompletions(s - 1, h - 1) : 0);
    _motzMemo.set(key, v);
  }
  return v;
}
export function MotzkinCount(n: number): number {
  return n < 0 ? 0 : motzkinCompletions(n, 0);
}
/** rank-th Motzkin path, steps tried U(1) then L(0) then D(-1). */
export function MotzkinUnrank(n: number, rank: number): number[] {
  const total = MotzkinCount(n);
  let r = total ? ((rank % total) + total) % total : 0;
  const out: number[] = [];
  let h = 0;
  for (let s = n; s > 0; s--) {
    const up = motzkinCompletions(s - 1, h + 1);
    if (r < up) { out.push(1); h++; continue; }
    r -= up;
    const lvl = motzkinCompletions(s - 1, h);
    if (r < lvl) { out.push(0); continue; }
    r -= lvl;
    out.push(-1); h--;
  }
  return out;
}
export function MotzkinRank(path: number[]): number {
  let r = 0, h = 0;
  for (let i = 0; i < path.length; i++) {
    const s = path.length - i;
    const step = path[i];
    if (step === 1) { h++; }
    else if (step === 0) { r += motzkinCompletions(s - 1, h + 1); }
    else { r += motzkinCompletions(s - 1, h + 1) + motzkinCompletions(s - 1, h); h--; }
  }
  return r;
}
export function IsMotzkinPath(path: number[], n: number): boolean {
  if (!Array.isArray(path) || path.length !== n) return false;
  let h = 0;
  for (const s of path) { if (s !== -1 && s !== 0 && s !== 1) return false; h += s; if (h < 0) return false; }
  return h === 0;
}

// ─── FibonacciWords(n): 0/1 strings of length n with no two consecutive 1s. Count Fibonacci(n+2). ────────
// h(m,last) = #valid suffixes of length m given previous bit `last`.
function fibComp(m: number, last: number): number {
  if (m === 0) return 1;
  return last === 1 ? fibComp(m - 1, 0) : fibComp(m - 1, 0) + fibComp(m - 1, 1);
}
export function FibonacciWordCount(n: number): number {
  return fibComp(n, 0);
}
export function FibonacciWordUnrank(n: number, rank: number): number[] {
  const total = FibonacciWordCount(n);
  let r = total ? ((rank % total) + total) % total : 0;
  const out: number[] = [];
  let last = 0;
  for (let i = 0; i < n; i++) {
    const zero = fibComp(n - i - 1, 0); // place a 0
    if (r < zero) { out.push(0); last = 0; continue; }
    r -= zero;
    out.push(1); last = 1; // place a 1 (only allowed if last !== 1, guaranteed by the count split)
    void last;
  }
  return out;
}
export function FibonacciWordRank(word: number[]): number {
  let r = 0;
  for (let i = 0; i < word.length; i++) if (word[i] === 1) r += fibComp(word.length - i - 1, 0);
  return r;
}
export function IsFibonacciWord(word: number[], n: number): boolean {
  if (!Array.isArray(word) || word.length !== n) return false;
  for (let i = 0; i < n; i++) {
    if (word[i] !== 0 && word[i] !== 1) return false;
    if (i > 0 && word[i] === 1 && word[i - 1] === 1) return false;
  }
  return true;
}

// ─── GrayCodeSubsets(n): the subsets of [n] in binary-reflected Gray-code order (consecutive differ by one). ─
export function GrayCodeSubsetUnrank(n: number, rank: number): number[] {
  const N = 2 ** n;
  const r = N ? ((rank % N) + N) % N : 0;
  const g = r ^ (r >> 1);
  const out: number[] = [];
  for (let i = 0; i < n; i++) if ((g >> i) & 1) out.push(i + 1);
  return out;
}
export function GrayCodeSubsetRank(s: number[]): number {
  let g = 0;
  for (const x of s) g |= 1 << (x - 1);
  let r = g;
  for (let shift = 1; shift < 31; shift <<= 1) r ^= r >> shift; // inverse Gray
  return r;
}

// ─── BinaryTrees(n): binary trees with n internal nodes (Catalan). Element nested: leaf 0, node [L,R]. ─────
export type BinTree = 0 | [BinTree, BinTree];
export function BinaryTreeCount(n: number): number {
  return Catalan(n);
}
export function BinaryTreeUnrank(n: number, rank: number): BinTree {
  if (n === 0) return 0;
  const total = Catalan(n);
  let r = total ? ((rank % total) + total) % total : 0;
  for (let i = 0; i < n; i++) {
    const cl = Catalan(i), cr = Catalan(n - 1 - i);
    const block = cl * cr;
    if (r < block) return [BinaryTreeUnrank(i, Math.floor(r / cr)), BinaryTreeUnrank(n - 1 - i, r % cr)];
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
  for (let i = 0; i < li; i++) base += Catalan(i) * Catalan(n - 1 - i);
  const cr = Catalan(n - 1 - li);
  return base + BinaryTreeRank(t[0]) * cr + BinaryTreeRank(t[1]);
}
export function IsBinaryTree(t: any, n: number): boolean {
  const ok = (x: any): boolean => x === 0 || (Array.isArray(x) && x.length === 2 && ok(x[0]) && ok(x[1]));
  return ok(t) && binTreeSize(t) === n;
}

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
  const pIdx = Math.floor(r / per);
  let rem = r % per;
  const p = others[pIdx];
  if (rem < dA) {
    sigma.set(m, p); sigma.set(p, m);
    derangeRec(S.filter((x) => x !== m && x !== p), rem, sigma);
  } else {
    rem -= dA;
    const sub = S.slice(0, s - 1); // S \ {m}
    derangeRec(sub, rem, sigma); // τ on S\{m}
    // redirect: y with τ(y)=p now maps to m; and m maps to p
    let y = -1;
    for (const x of sub) if (sigma.get(x) === p) { y = x; break; }
    sigma.set(m, p);
    sigma.set(y, m);
  }
}
export function DerangementUnrank(n: number, rank: number): number[] {
  const total = DerangementCount(n);
  if (total <= 0) return n === 0 ? [] : [];
  const sigma = new Map<number, number>();
  derangeRec(Array.from({ length: n }, (_, i) => i + 1), ((rank % total) + total) % total, sigma);
  return Array.from({ length: n }, (_, i) => sigma.get(i + 1)!);
}
export function DerangementRank(image: number[]): number {
  const n = image.length;
  const rankRec = (S: number[], sig: Map<number, number>): number => {
    const s = S.length;
    if (s === 0) return 0;
    const m = S[s - 1];
    const others = S.slice(0, s - 1);
    const dA = subfactorial(s - 2), dB = subfactorial(s - 1);
    const p = sig.get(m)!;
    const pIdx = others.indexOf(p);
    let base = pIdx * (dA + dB);
    if (sig.get(p) === m) {
      // 2-cycle case A
      return base + rankRec(S.filter((x) => x !== m && x !== p), sig);
    }
    // case B: reconstruct τ on S\{m}: y (=sig^{-1}(m)) maps to p in τ
    base += dA;
    let y = -1;
    for (const x of others) if (sig.get(x) === m) { y = x; break; }
    const tau = new Map(sig);
    tau.delete(m);
    tau.set(y, p);
    return base + rankRec(S.slice(0, s - 1), tau);
  };
  const sig = new Map<number, number>();
  image.forEach((v, i) => sig.set(i + 1, v));
  return rankRec(Array.from({ length: n }, (_, i) => i + 1), sig);
}
export function IsDerangementOf(image: number[], n: number): boolean {
  if (!Array.isArray(image) || image.length !== n) return false;
  const seen = new Array(n + 1).fill(false);
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
export function DistinctPartitionCount(n: number): number {
  return n < 0 ? 0 : distinctParts(n, n);
}
export function DistinctPartitionUnrank(n: number, rank: number): number[] {
  const total = DistinctPartitionCount(n);
  let r = total ? ((rank % total) + total) % total : 0;
  const out: number[] = [];
  let m = n, upper = n;
  while (m > 0) {
    for (let part = Math.min(m, upper); part >= 1; part--) {
      const c = distinctParts(m - part, part - 1);
      if (r < c) { out.push(part); m -= part; upper = part - 1; break; }
      r -= c;
    }
  }
  return out;
}
export function DistinctPartitionRank(p: number[], n: number): number {
  const parts = [...p].sort((a, b) => b - a);
  let r = 0, m = n, upper = n;
  for (const part of parts) {
    for (let v = Math.min(m, upper); v > part; v--) r += distinctParts(m - v, v - 1);
    m -= part; upper = part - 1;
  }
  return r;
}
export function IsDistinctPartitionOf(p: number[], n: number): boolean {
  if (!Array.isArray(p)) return false;
  const seen = new Set<number>();
  let s = 0;
  for (const x of p) { if (!Number.isInteger(x) || x < 1 || seen.has(x)) return false; seen.add(x); s += x; }
  return s === n;
}

// ─── PartitionsInBox(a,b): partitions with ≤ a parts, each ≤ b. Count C(a+b,a) (lattice-path bijection). ─
export function PartitionsInBoxCount(a: number, b: number): number {
  return Binomial(a + b, a);
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
export function PartitionsInBoxRank(p: number[], a: number, b: number): number {
  const parts = [...p].sort((x, y) => y - x);
  while (parts.length < a) parts.push(0); // pad to a parts
  // reconstruct the 0/1 path: eBefore_i = b - part_i (non-decreasing since parts non-increasing)
  const path: number[] = [];
  let placedE = 0;
  for (const part of parts) {
    const eBefore = b - part;
    while (placedE < eBefore) { path.push(0); placedE++; }
    path.push(1);
  }
  while (placedE < b) { path.push(0); placedE++; }
  return LatticePathRank(path);
}
export function IsPartitionInBox(p: number[], a: number, b: number): boolean {
  if (!Array.isArray(p) || p.length > a) return false;
  let prev = Infinity;
  for (const x of p) { if (!Number.isInteger(x) || x < 1 || x > b || x > prev) return false; prev = x; }
  return true;
}
