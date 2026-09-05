// Set-partition rank/unrank via restricted growth strings (RGS: w[0]=0, w[i] ≤ 1+max(w[0..i-1])), plus the
// exactly-k-blocks slice. Ported from ~/Playground/ideas/numbers/src/restrictedGrowthStrings.ts (rgsRank/
// rgsUnrank/rgsCount) — set_partitions_into_k_blocks has no numbers-repo precursor, written fresh here against
// the SQL floor in set_partitions_into_k_blocks.sql.
//
// Neither set_partitions nor set_partitions_into_k_blocks expose a bare-callable rank/unrank SQL function —
// unranking is GENERIC-FRAMEWORK dispatched (`unrank(<collection>(n[,k]), r)`). Both walk the SAME plain
// lexicographic order over the RGS array that the SQL floor emits (`ORDER BY rgs`), so these are direct
// order-preserving twins — verified in selfcert-math.mts against `notation((unrank(set_partitions(n), r)).value)`
// / `...set_partitions_into_k_blocks(n,k)...` (notation() is array_to_string(rgs, '')).
//
//   numbers-repo name  →  SQL name (file)
//   rgsCount            →  bell(n) (set_partitions.sql) — already ported as `bell` in combinat.ts, reused here
//   rgsRank/rgsUnrank    →  generic unrank(set_partitions(n), r) (set_partitions.sql)
//   (fresh, no precursor) →  generic unrank(set_partitions_into_k_blocks(n,k), r) (set_partitions_into_k_blocks.sql)
//                            count twin: stirling_second(n,k) (set_partitions_into_k_blocks.sql), already
//                            ported in combinat.ts, reused here

import { bell } from "./combinat.js";

export type RestrictedGrowthString = number[];

// B(k, m): number of RGS suffixes of length k given current max block index m.
// B(0, m) = 1; B(k, m) = (m+1)*B(k-1, m) + B(k-1, m+1). Computed column by column (column k from column k-1).
function buildBTable(n: number): number[][] {
  const b: number[][] = Array.from({ length: n + 1 }, () => new Array(n + 2).fill(0));
  for (let m = 0; m <= n + 1; m++) b[0][m] = 1;
  for (let k = 1; k <= n; k++) {
    for (let m = n; m >= 0; m--) b[k][m] = (m + 1) * b[k - 1][m] + b[k - 1][m + 1];
  }
  return b;
}
const _btableCache = new Map<number, number[][]>();
function getBTable(n: number): number[][] {
  const cached = _btableCache.get(n);
  if (cached) return cached;
  const t = buildBTable(n);
  _btableCache.set(n, t);
  return t;
}

/** No bare SQL fn (generic dispatch) — lex rank of an RGS; walks the same order set_partitions.sql emits. */
export function rgsRank(w: RestrictedGrowthString): number {
  const n = w.length;
  if (n === 0) return 0;
  const b = getBTable(n);
  let rank = 0;
  let m = 0;
  for (let i = 1; i < n; i++) {
    rank += w[i] * b[n - 1 - i][m];
    if (w[i] > m) m = w[i];
  }
  return rank;
}

/** No bare SQL fn (generic dispatch) — the exact inverse of rgsRank; total = bell(n). */
export function rgsUnrank(n: number, rank: number): RestrictedGrowthString {
  if (n === 0) return [];
  const total = bell(n);
  const r = ((rank % total) + total) % total;
  const b = getBTable(n);
  const result: number[] = [0];
  let m = 0;
  let remaining = r;
  for (let i = 1; i < n; i++) {
    const bval = b[n - 1 - i][m];
    let wi = Math.floor(remaining / bval);
    if (wi > m + 1) wi = m + 1; // clamp to valid range
    result.push(wi);
    remaining -= wi * bval;
    if (wi > m) m = wi;
  }
  return result;
}

// ── exactly-k-blocks slice (set_partitions_into_k_blocks.sql) ──────────────────────────────────────────
// BK(remaining, m, k): number of ways to complete an RGS suffix of length `remaining`, given current max block
// index m (−1 = nothing placed yet), such that the FULL string ends with max = k−1 (exactly k blocks). At each
// step a value v ranges 0..min(m+1, k−1): (m+1) ways reuse an already-seen block (v ≤ m, max stays m), plus one
// way (v = m+1, if ≤ k−1) that opens a new block. Mirrors set_partitions_into_k_blocks.sql's capped prefix-grow.
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

/** No bare SQL fn (generic dispatch) — RGS of length n with max exactly k−1, in lex order. Count = stirling_second(n,k). */
export function setPartitionsIntoKBlocksRank(w: RestrictedGrowthString, k: number): number {
  const n = w.length;
  let rank = 0;
  let m = -1;
  for (let i = 0; i < n; i++) {
    const v = w[i];
    const remainingAfter = n - i - 1;
    for (let c = 0; c < v; c++) rank += countKBlockCompletions(remainingAfter, Math.max(m, c), k);
    m = Math.max(m, v);
  }
  return rank;
}

/** No bare SQL fn (generic dispatch) — the exact inverse of setPartitionsIntoKBlocksRank. */
export function setPartitionsIntoKBlocksUnrank(n: number, k: number, rank: number): RestrictedGrowthString {
  const total = countKBlockCompletions(n, -1, k);
  let r = total ? ((rank % total) + total) % total : 0;
  const out: RestrictedGrowthString = [];
  let m = -1;
  for (let i = 0; i < n; i++) {
    const remainingAfter = n - i - 1;
    const hi = Math.min(m + 1, k - 1);
    for (let v = 0; v <= hi; v++) {
      const cnt = countKBlockCompletions(remainingAfter, Math.max(m, v), k);
      if (r < cnt) {
        out.push(v);
        m = Math.max(m, v);
        break;
      }
      r -= cnt;
    }
  }
  return out;
}
