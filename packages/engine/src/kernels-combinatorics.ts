// PascalCase kernels for the six certified families beyond permutations, inlined from @enumeratio/math
// (compositions.ts / integer_partitions.ts / set_partitions.ts / set_compositions.ts / combinat.ts) so the
// package stays a standalone, zero-runtime-dep compute-engine library. Each count/unrank is order-certified
// against the SQL floor by selfcert-math.mts; kernel name IS the concept, no mapping table.

import { Factorial } from "./kernels.js";

// ─── counts ──────────────────────────────────────────────────────────────────────────────────────────

/** C(n,k). */
export function Binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return Math.round(c);
}

/** #integer compositions of n = 2^(n-1) for n ≥ 1, 1 for n = 0. */
export function CompositionCount(n: number): number {
  return n <= 0 ? 1 : 2 ** (n - 1);
}

/** BellB(n) = #set partitions of [n], via the BellB triangle. */
export function BellB(n: number): number {
  if (n <= 0) return 1;
  let row = [1];
  for (let i = 1; i <= n; i++) {
    const next = [row[row.length - 1]];
    for (let j = 0; j < row.length; j++) next.push(next[j] + row[j]);
    row = next;
  }
  return row[0];
}

/** Fubini(n) = #set compositions (ordered set partitions) of [n] = Σ_k C(n,k)·Fubini(n−k). */
export function Fubini(n: number): number {
  const a = [1];
  for (let m = 1; m <= n; m++) {
    let s = 0;
    for (let k = 1; k <= m; k++) s += Binomial(m, k) * a[m - k];
    a[m] = s;
  }
  return a[n];
}

const _stirling2 = new Map<string, number>();
/** Stirling second kind S(n,k) = #set partitions of [n] into exactly k blocks. */
export function StirlingS2(n: number, k: number): number {
  if (n === 0) return k === 0 ? 1 : 0;
  if (k <= 0 || k > n) return 0;
  const key = `${n},${k}`;
  let v = _stirling2.get(key);
  if (v === undefined) {
    v = k * StirlingS2(n - 1, k) + StirlingS2(n - 1, k - 1);
    _stirling2.set(key, v);
  }
  return v;
}

/** p(n) = #integer partitions of n, Euler's pentagonal-number recurrence. */
export function PartitionNumber(n: number): number {
  if (n < 0) return 0;
  const p = [1];
  for (let m = 1; m <= n; m++) {
    let sum = 0;
    for (let k = 1; ; k++) {
      const g1 = (k * (3 * k - 1)) / 2;
      const g2 = (k * (3 * k + 1)) / 2;
      if (g1 > m && g2 > m) break;
      const sign = k % 2 === 1 ? 1 : -1;
      if (g1 <= m) sum += sign * p[m - g1];
      if (g2 <= m) sum += sign * p[m - g2];
    }
    p[m] = sum;
  }
  return p[n];
}

// #partitions of m into exactly j parts, each ≤ cap. Makes the k-slice unrank O(poly).
const _pekMemo = new Map<string, number>();
function partsExactlyK(m: number, j: number, cap: number): number {
  if (j === 0) return m === 0 ? 1 : 0;
  if (m < j || cap < 1) return 0;
  const c = Math.min(cap, m - (j - 1));
  if (c < 1) return 0;
  const key = `${m},${j},${c}`;
  let v = _pekMemo.get(key);
  if (v === undefined) {
    let s = 0;
    for (let part = 1; part <= c; part++) s += partsExactlyK(m - part, j - 1, part);
    _pekMemo.set(key, (v = s));
  }
  return v;
}

/** p(n,k) = #integer partitions of n into exactly k parts. */
export function KPartPartitionCount(n: number, k: number): number {
  if (n <= 0) return k === 0 ? 1 : 0;
  return k < 1 || k > n ? 0 : partsExactlyK(n, k, n);
}

/** #surjections [n] ↠ [k] = k!·S(n,k) — one k-level of the set_compositions floor. */
export function CountSurjections(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0) return n === 0 ? 1 : 0;
  return Factorial(k) * StirlingS2(n, k);
}

// #partitions of m with every part ≤ j.
const _pamMemo = new Map<string, number>();
function partsAtMost(m: number, j: number): number {
  if (m === 0) return 1;
  if (m < 0 || j <= 0) return 0;
  const key = `${m},${j}`;
  let v = _pamMemo.get(key);
  if (v === undefined) {
    v = partsAtMost(m, j - 1) + partsAtMost(m - j, j);
    _pamMemo.set(key, v);
  }
  return v;
}

// ─── unranks (all 0-based, same order as the SQL floor) ────────────────────────────────────────────────

/** The rank-th composition of n by the gap-cut bijection (mask IS the rank). SQL twin: composition_from_mask. */
export function CompositionFromMask(n: number, mask: number): number[] {
  if (n === 0) return [];
  const parts: number[] = [];
  let run = 1;
  for (let i = 1; i <= n - 1; i++) {
    if ((mask >> (i - 1)) & 1) { parts.push(run); run = 1; }
    else run++;
  }
  parts.push(run);
  return parts;
}

/** rank-th integer partition of n, largest-part-first order. */
export function IntegerPartitionUnrank(n: number, rank: number): number[] {
  const total = PartitionNumber(n);
  let r = total ? ((rank % total) + total) % total : 0;
  const out: number[] = [];
  let m = n, max = n;
  while (m > 0) {
    for (let k = Math.min(m, max); k >= 1; k--) {
      const cnt = partsAtMost(m - k, k);
      if (r < cnt) { out.push(k); m -= k; max = k; break; }
      r -= cnt;
    }
  }
  return out;
}

/** rank-th integer partition of n into exactly k parts. */
export function IntegerPartitionKUnrank(n: number, k: number, rank: number): number[] {
  const total = KPartPartitionCount(n, k);
  if (total <= 0) return [];
  let r = ((rank % total) + total) % total;
  const out: number[] = [];
  let m = n, j = k, cap = n;
  while (j > 0) {
    const hi = Math.min(cap, m - (j - 1));
    for (let part = hi; part >= 1; part--) {
      const cnt = partsExactlyK(m - part, j - 1, part);
      if (r < cnt) { out.push(part); m -= part; cap = part; j--; break; }
      r -= cnt;
    }
  }
  return out;
}

// RGS suffix table B(k,m): B(0,m)=1; B(k,m)=(m+1)·B(k-1,m)+B(k-1,m+1).
const _btableCache = new Map<number, number[][]>();
function getBTable(n: number): number[][] {
  const cached = _btableCache.get(n);
  if (cached) return cached;
  const b: number[][] = Array.from({ length: n + 1 }, () => new Array(n + 2).fill(0));
  for (let m = 0; m <= n + 1; m++) b[0][m] = 1;
  for (let k = 1; k <= n; k++) for (let m = n; m >= 0; m--) b[k][m] = (m + 1) * b[k - 1][m] + b[k - 1][m + 1];
  _btableCache.set(n, b);
  return b;
}

/** rank-th restricted growth string of length n, lex order. Count = BellB(n). */
export function RgsUnrank(n: number, rank: number): number[] {
  if (n === 0) return [];
  const total = BellB(n);
  const r = ((rank % total) + total) % total;
  const b = getBTable(n);
  const result: number[] = [0];
  let m = 0, remaining = r;
  for (let i = 1; i < n; i++) {
    const bval = b[n - 1 - i][m];
    let wi = Math.floor(remaining / bval);
    if (wi > m + 1) wi = m + 1;
    result.push(wi);
    remaining -= wi * bval;
    if (wi > m) m = wi;
  }
  return result;
}

// #ways to complete an RGS suffix of length `remaining` ending with max exactly k−1.
const _bkMemo = new Map<string, number>();
function countKBlockCompletions(remaining: number, m: number, k: number): number {
  if (remaining === 0) return m === k - 1 ? 1 : 0;
  const key = `${remaining},${m},${k}`;
  let v = _bkMemo.get(key);
  if (v === undefined) {
    v = (m + 1) * countKBlockCompletions(remaining - 1, m, k);
    if (m + 1 <= k - 1) v += countKBlockCompletions(remaining - 1, m + 1, k);
    _bkMemo.set(key, v);
  }
  return v;
}

/** rank-th RGS of length n with max exactly k−1 (exactly k blocks), lex order. Count = StirlingS2(n,k). */
export function SetPartitionsIntoKBlocksUnrank(n: number, k: number, rank: number): number[] {
  const total = countKBlockCompletions(n, -1, k);
  let r = total ? ((rank % total) + total) % total : 0;
  const out: number[] = [];
  let m = -1;
  for (let i = 0; i < n; i++) {
    const remainingAfter = n - i - 1;
    const hi = Math.min(m + 1, k - 1);
    for (let v = 0; v <= hi; v++) {
      const cnt = countKBlockCompletions(remainingAfter, Math.max(m, v), k);
      if (r < cnt) { out.push(v); m = Math.max(m, v); break; }
      r -= cnt;
    }
  }
  return out;
}

// #ways to fill `remaining` label positions (alphabet 1..k) with `missing` still-unused labels to place.
const _nMemo = new Map<string, number>();
function countCompletions(remaining: number, missing: number, k: number): number {
  if (remaining === 0) return missing === 0 ? 1 : 0;
  if (missing > remaining) return 0;
  const key = `${remaining},${missing},${k}`;
  let v = _nMemo.get(key);
  if (v === undefined) {
    v = missing * countCompletions(remaining - 1, missing - 1, k) + (k - missing) * countCompletions(remaining - 1, missing, k);
    _nMemo.set(key, v);
  }
  return v;
}

/** rank-th set composition of [n] as labels[i] = 1-based block index of element i. Count = Fubini(n).
 *  Floor order: k ascending, then lex on labels. */
export function SetCompositionUnrank(n: number, rank: number): number[] {
  if (n === 0) return [];
  const total = Fubini(n);
  let r = total ? ((rank % total) + total) % total : 0;
  let k = 1;
  for (;;) { const cnt = CountSurjections(n, k); if (r < cnt) break; r -= cnt; k++; }
  const labels: number[] = [];
  const used = new Set<number>();
  let missing = k;
  for (let i = 0; i < n; i++) {
    const remainingAfter = n - i - 1;
    for (let c = 1; c <= k; c++) {
      const m2 = missing - (used.has(c) ? 0 : 1);
      const cnt = countCompletions(remainingAfter, m2, k);
      if (r < cnt) { labels.push(c); if (!used.has(c)) { used.add(c); missing--; } break; }
      r -= cnt;
    }
  }
  return labels;
}

// ─── element shaping: RGS/labels → blocks (element as a CE value) ───────────────────────────────────────

/** RGS w → blocks of 1-based element indices, block b = { i+1 : w[i] = b }, b = 0..max. */
export function RgsToBlocks(w: number[]): number[][] {
  const blocks: number[][] = [];
  for (let i = 0; i < w.length; i++) {
    const b = w[i];
    (blocks[b] ??= []).push(i + 1);
  }
  return blocks;
}

/** labels → ORDERED blocks; block j = { i+1 : labels[i] = j }, j = 1..k, in block-index order. */
export function LabelsToOrderedBlocks(labels: number[]): number[][] {
  const k = labels.length === 0 ? 0 : Math.max(...labels);
  const blocks: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < labels.length; i++) blocks[labels[i] - 1].push(i + 1);
  return blocks;
}

// ─── membership validators (structural: is target a valid element of the family) ────────────────────────

/** Positive integer parts summing to n (a composition of n; order significant but any order is a member). */
export function IsCompositionOf(parts: number[], n: number): boolean {
  if (!Array.isArray(parts)) return false;
  let s = 0;
  for (const p of parts) { if (!Number.isInteger(p) || p < 1) return false; s += p; }
  return s === n && (n > 0 || parts.length === 0);
}

/** A partition of n (multiset of positive parts summing to n); k, if given, pins the number of parts. */
export function IsPartitionOf(parts: number[], n: number, k?: number): boolean {
  if (!IsCompositionOf(parts, n)) return false;
  return k === undefined || parts.length === k;
}

/** Blocks form a partition of [n] into nonempty blocks; k, if given, pins the block count. Order-insensitive. */
export function IsSetPartitionOf(blocks: number[][], n: number, k?: number): boolean {
  if (!Array.isArray(blocks)) return false;
  if (k !== undefined && blocks.length !== k) return false;
  const seen = new Array(n + 1).fill(false);
  let total = 0;
  for (const blk of blocks) {
    if (!Array.isArray(blk) || blk.length === 0) return false;
    for (const x of blk) {
      if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return false;
      seen[x] = true;
      total++;
    }
  }
  return total === n;
}

// ─── ranks (element → 0-based index; exact inverses of the unranks above) ───────────────────────────────

/** Composition → gap-cut mask (its rank). */
export function CompositionRank(parts: number[]): number {
  let mask = 0, cum = 0;
  for (let i = 0; i < parts.length - 1; i++) { cum += parts[i]; mask |= 1 << (cum - 1); }
  return mask;
}

/** Integer partition of n → its largest-part-first rank. */
export function IntegerPartitionRank(p: number[], n: number): number {
  const parts = [...p].sort((a, z) => z - a);
  let r = 0, m = n, max = n;
  for (const part of parts) {
    for (let k = Math.min(m, max); k > part; k--) r += partsAtMost(m - k, k);
    m -= part; max = part;
  }
  return r;
}

/** Integer partition of n into k parts → its rank within that k-slice. */
export function IntegerPartitionKRank(p: number[], n: number): number {
  const parts = [...p].sort((a, z) => z - a);
  const k = parts.length;
  let r = 0, m = n, j = k, cap = n;
  for (const part of parts) {
    const hi = Math.min(cap, m - (j - 1));
    for (let v = hi; v > part; v--) r += partsExactlyK(m - v, j - 1, v);
    m -= part; cap = part; j--;
  }
  return r;
}

/** RGS → its lex rank. */
export function RgsRank(w: number[]): number {
  const n = w.length;
  if (n === 0) return 0;
  const b = getBTable(n);
  let rank = 0, m = 0;
  for (let i = 1; i < n; i++) { rank += w[i] * b[n - 1 - i][m]; if (w[i] > m) m = w[i]; }
  return rank;
}

/** RGS with exactly k blocks → its rank within that k-slice. */
export function SetPartitionsIntoKBlocksRank(w: number[], k: number): number {
  const n = w.length;
  let rank = 0, m = -1;
  for (let i = 0; i < n; i++) {
    const v = w[i];
    const remainingAfter = n - i - 1;
    for (let c = 0; c < v; c++) rank += countKBlockCompletions(remainingAfter, Math.max(m, c), k);
    m = Math.max(m, v);
  }
  return rank;
}

/** Set-composition labels (labels[i] = 1-based block index of element i) → its global rank. */
export function SetCompositionRank(labels: number[], n: number): number {
  const k = labels.length === 0 ? 0 : Math.max(...labels);
  let base = 0;
  for (let kp = 1; kp < k; kp++) base += CountSurjections(n, kp);
  let local = 0;
  const used = new Set<number>();
  let missing = k;
  for (let i = 0; i < n; i++) {
    const label = labels[i];
    const remainingAfter = n - i - 1;
    for (let c = 1; c < label; c++) {
      const m2 = missing - (used.has(c) ? 0 : 1);
      local += countCompletions(remainingAfter, m2, k);
    }
    if (!used.has(label)) { used.add(label); missing--; }
  }
  return base + local;
}

// ─── block-shape → carrier (for ranking a set partition / composition given as blocks) ──────────────────

/** Blocks → canonical RGS: blocks ordered by least element, w[x-1] = that block's 0-based position. */
export function BlocksToRgs(blocks: number[][], n: number): number[] {
  const ordered = blocks.filter((b) => b.length).sort((a, b) => Math.min(...a) - Math.min(...b));
  const w = new Array(n).fill(0);
  ordered.forEach((blk, bi) => blk.forEach((x) => (w[x - 1] = bi)));
  return w;
}

/** Ordered blocks → labels[x-1] = 1-based block index in the GIVEN order (order significant). */
export function BlocksToLabels(blocks: number[][]): number[] {
  const n = blocks.reduce((s, b) => s + b.length, 0);
  const labels = new Array(n).fill(0);
  blocks.forEach((blk, bi) => blk.forEach((x) => (labels[x - 1] = bi + 1)));
  return labels;
}
