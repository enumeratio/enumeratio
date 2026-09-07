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
