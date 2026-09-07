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
