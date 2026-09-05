// Integer-partition rank/unrank, incl. the k-part-count slice. Ported from
// ~/Playground/ideas/numbers/src/combinat.ts (integerPartitionRank/Unrank, integerPartitionKRank/Unrank/Count).
//
// Neither integer_partitions nor k_part_partitions expose a bare-callable rank/unrank SQL function — unranking
// is GENERIC-FRAMEWORK dispatched (`unrank(<collection>(n[,k]), r)`, see packages/data/sqlsrc/realizer.sql).
// Both walk the SAME reverse-lexicographic (largest-part-first) order that partition_generate() emits
// (integer_partitions.sql / k_part_partitions.sql), which is exactly the order integerPartitions() here
// enumerates in, so these are direct order-preserving twins — verified in selfcert-math.mts by comparing
// against `notation((unrank(integer_partitions(n), r)).value)` / `...k_part_partitions(n,k)...` over a range.
//
//   numbers-repo name        →  SQL name (file)
//   partitionCount            →  partition_number (integer_partitions.sql) — already ported as partition_number
//                                 in combinat.ts; reused here, not re-exported
//   integerPartitionRank/Unrank → generic unrank(integer_partitions(n), r) (integer_partitions.sql)
//   integerPartitionKCount     →  k_part_partition_count(n,k) (k_part_partitions.sql)
//   integerPartitionKRank/Unrank → generic unrank(k_part_partitions(n,k), r) (k_part_partitions.sql)

import { partition_number } from "./combinat.js";

export type IntegerPartition = number[];

// number of partitions of m with every part ≤ j — the size of the largest-part-first block. Makes rank/unrank
// O(n²) instead of an enumeration: p(m,j) = (no part j) + (≥ one part j).
const _pamMemo = new Map<string, number>();
function partsAtMost(m: number, j: number): number {
  if (m === 0) return 1;
  if (m < 0 || j <= 0) return 0;
  const key = m + "," + j;
  let v = _pamMemo.get(key);
  if (v === undefined) {
    v = partsAtMost(m, j - 1) + partsAtMost(m - j, j);
    _pamMemo.set(key, v);
  }
  return v;
}

/** No bare SQL fn (generic dispatch) — rank/unrank walk the same largest-part-first order the SQL floor emits. */
export function integerPartitionRank(p: IntegerPartition, n: number): number {
  const parts = [...p].sort((a, z) => z - a);
  let r = 0;
  let m = n;
  let max = n;
  for (const part of parts) {
    for (let k = Math.min(m, max); k > part; k--) r += partsAtMost(m - k, k);
    m -= part;
    max = part;
  }
  return r;
}

/** No bare SQL fn (generic dispatch) — see integerPartitionRank; total = partition_number(n). */
export function integerPartitionUnrank(n: number, rank: number): IntegerPartition {
  const total = partition_number(n);
  let r = total ? ((rank % total) + total) % total : 0;
  const out: IntegerPartition = [];
  let m = n;
  let max = n;
  while (m > 0) {
    for (let k = Math.min(m, max); k >= 1; k--) {
      const cnt = partsAtMost(m - k, k);
      if (r < cnt) {
        out.push(k);
        m -= k;
        max = k;
        break;
      }
      r -= cnt;
    }
  }
  return out;
}

// number of partitions of m into exactly j parts, each part ≤ cap — makes the k-slice rank/unrank O(poly).
// Recurrence on the largest part v: pick v (1≤v≤min(cap,m)), then partition m−v into j−1 parts each ≤ v.
const _pekMemo = new Map<string, number>();
function partsExactlyK(m: number, j: number, cap: number): number {
  if (j === 0) return m === 0 ? 1 : 0;
  if (m < j || cap < 1) return 0; // need ≥1 per part
  const c = Math.min(cap, m - (j - 1)); // largest part can't starve the remaining j−1 parts of ≥1 each
  if (c < 1) return 0;
  const key = m + "," + j + "," + c;
  let v = _pekMemo.get(key);
  if (v === undefined) {
    let s = 0;
    for (let part = 1; part <= c; part++) s += partsExactlyK(m - part, j - 1, part);
    _pekMemo.set(key, (v = s));
  }
  return v;
}

/** SQL twin: k_part_partition_count(n int, k int) — k_part_partitions.sql. p(n,k), 2-D DP (same recurrence). */
export function integerPartitionKCount(n: number, k: number): number {
  if (n <= 0) return k === 0 ? 1 : 0;
  return k < 1 || k > n ? 0 : partsExactlyK(n, k, n);
}

/** No bare SQL fn (generic dispatch) — walks the same largest-part-first order, constrained to k parts. */
export function integerPartitionKUnrank(n: number, k: number, rank: number): IntegerPartition {
  const total = integerPartitionKCount(n, k);
  if (total <= 0) return [];
  let r = ((rank % total) + total) % total;
  const out: IntegerPartition = [];
  let m = n;
  let j = k;
  let cap = n;
  while (j > 0) {
    const hi = Math.min(cap, m - (j - 1)); // largest feasible part this step
    for (let part = hi; part >= 1; part--) {
      const cnt = partsExactlyK(m - part, j - 1, part);
      if (r < cnt) {
        out.push(part);
        m -= part;
        cap = part;
        j--;
        break;
      }
      r -= cnt;
    }
  }
  return out;
}

/** No bare SQL fn (generic dispatch) — the exact inverse of integerPartitionKUnrank. */
export function integerPartitionKRank(p: IntegerPartition, n: number): number {
  const parts = [...p].sort((a, z) => z - a);
  const k = parts.length;
  let r = 0;
  let m = n;
  let j = k;
  let cap = n;
  for (const part of parts) {
    const hi = Math.min(cap, m - (j - 1));
    for (let v = hi; v > part; v--) r += partsExactlyK(m - v, j - 1, v);
    m -= part;
    cap = part;
    j--;
  }
  return r;
}
