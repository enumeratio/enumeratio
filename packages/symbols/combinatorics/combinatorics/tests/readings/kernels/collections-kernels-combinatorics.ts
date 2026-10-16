// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import {
  Binomial,
  StirlingS2,
  countKBlockCompletions,
  getBTable,
} from "../../../collections/src/families/kernels-combinatorics.ts";
import { Factorial, modRank } from "../../../collections/src/families/kernels.ts";

/** Ordered blocks → labels[x-1] = 1-based block index in the GIVEN order (order significant). */
export function BlocksToLabels(blocks: number[][]): number[] {
  const n = blocks.reduce((s, b) => s + b.length, 0);
  const labels = Array.from({ length: n }, () => 0);
  blocks.forEach((blk, bi) => blk.forEach((x) => (labels[x - 1] = bi + 1)));
  return labels;
}

/** #surjections [n] ↠ [k] = k!·S(n,k) — one k-level of the set_compositions floor. */
export function CountSurjections(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0) return n === 0 ? 1 : 0;
  return Factorial(k) * StirlingS2(n, k);
}

// #ways to fill `remaining` label positions (alphabet 1..k) with `missing` still-unused labels to place.
export const _nMemo = new Map<string, number>();

export function countCompletions(remaining: number, missing: number, k: number): number {
  if (remaining === 0) return missing === 0 ? 1 : 0;
  if (missing > remaining) return 0;
  const key = `${remaining},${missing},${k}`;
  let v = _nMemo.get(key);
  if (v === undefined) {
    v =
      missing * countCompletions(remaining - 1, missing - 1, k) +
      (k - missing) * countCompletions(remaining - 1, missing, k);
    _nMemo.set(key, v);
  }
  return v;
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
    if (!used.has(label)) {
      used.add(label);
      missing--;
    }
  }
  return base + local;
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

/** rank-th set composition of [n] as labels[i] = 1-based block index of element i. Count = Fubini(n).
 *  Floor order: k ascending, then lex on labels. */
export function SetCompositionUnrank(n: number, rank: number): number[] {
  if (n === 0) return [];
  const total = Fubini(n);
  let r = total ? modRank(rank, total) : 0;
  let k = 1;
  for (;;) {
    const cnt = CountSurjections(n, k);
    if (r < cnt) break;
    r -= cnt;
    k++;
  }
  const labels: number[] = [];
  const used = new Set<number>();
  let missing = k;
  for (let i = 0; i < n; i++) {
    const remainingAfter = n - i - 1;
    for (let c = 1; c <= k; c++) {
      const m2 = missing - (used.has(c) ? 0 : 1);
      const cnt = countCompletions(remainingAfter, m2, k);
      if (r < cnt) {
        labels.push(c);
        if (!used.has(c)) {
          used.add(c);
          missing--;
        }
        break;
      }
      r -= cnt;
    }
  }
  return labels;
}

/** labels → ORDERED blocks; block j = { i+1 : labels[i] = j }, j = 1..k, in block-index order. */
export function LabelsToOrderedBlocks(labels: number[]): number[][] {
  const k = labels.length === 0 ? 0 : Math.max(...labels);
  const blocks: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < labels.length; i++) blocks[labels[i] - 1].push(i + 1);
  return blocks;
}

/** RGS → its lex rank. */
export function RgsRank(w: number[]): number {
  const n = w.length;
  if (n === 0) return 0;
  const b = getBTable(n);
  let rank = 0,
    m = 0;
  for (let i = 1; i < n; i++) {
    rank += w[i] * b[n - 1 - i][m];
    if (w[i] > m) m = w[i];
  }
  return rank;
}

// ─── block-shape → carrier (for ranking a set partition / composition given as blocks) ──────────────────

/** Blocks → canonical RGS: blocks ordered by least element, w[x-1] = that block's 0-based position. */
export function BlocksToRgs(blocks: number[][], n: number): number[] {
  const ordered = blocks.filter((b) => b.length);
  ordered.sort((a, b) => Math.min(...a) - Math.min(...b));
  const w = Array.from({ length: n }, () => 0);
  ordered.forEach((blk, bi) => blk.forEach((x) => (w[x - 1] = bi)));
  return w;
}

/** RGS with exactly k blocks → its rank within that k-slice. */
export function SetPartitionsIntoKBlocksRank(w: number[], k: number): number {
  const n = w.length;
  let rank = 0,
    m = -1;
  for (let i = 0; i < n; i++) {
    const v = w[i];
    const remainingAfter = n - i - 1;
    for (let c = 0; c < v; c++) rank += countKBlockCompletions(remainingAfter, Math.max(m, c), k);
    m = Math.max(m, v);
  }
  return rank;
}
