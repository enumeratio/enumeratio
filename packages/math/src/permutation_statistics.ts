// Permutations-of-[n] sliced-by-statistic counting sequences. Ported from
// ~/Playground/ideas/numbers/src/permByStatistic.ts, renamed to match their SQL twins:
//   numbers-repo name  →  SQL name (file)
//   stirling1          →  stirling_first_unsigned (k_cycle_permutations.sql)
//   eulerianA          →  eulerian_number (k_descent_permutations.sql)
// cycleCount/descentCount aren't separately ported here — permutations.ts's inversions() plus
// perm_descents/perm_cycle_count (statistics.sql) are exercised directly in selfcert-math.mts instead.

// Unsigned Stirling numbers of the first kind c(n,k): permutations of [n] with k cycles.
// Recurrence: c(n,k) = c(n-1,k-1) + (n-1)·c(n-1,k).
const _c1 = new Map<string, number>();
/** SQL twin: stirling_first_unsigned(n int, k int) — k_cycle_permutations.sql. */
export function stirling1(n: number, k: number): number {
  if (n === 0) return k === 0 ? 1 : 0;
  if (k <= 0 || k > n) return 0;
  const key = `${n},${k}`;
  let v = _c1.get(key);
  if (v === undefined) {
    v = stirling1(n - 1, k - 1) + (n - 1) * stirling1(n - 1, k);
    _c1.set(key, v);
  }
  return v;
}

// Eulerian numbers A(n,k): permutations of [n] with exactly k descents.
// Recurrence: A(n,k) = (k+1)·A(n-1,k) + (n-k)·A(n-1,k-1). A(0,0)=1.
const _A = new Map<string, number>();
/** SQL twin: eulerian_number(n int, k int) — k_descent_permutations.sql. */
export function eulerianA(n: number, k: number): number {
  if (n === 0) return k === 0 ? 1 : 0;
  if (k < 0 || k >= n) return 0;
  const key = `${n},${k}`;
  let v = _A.get(key);
  if (v === undefined) {
    v = (k + 1) * eulerianA(n - 1, k) + (n - k) * eulerianA(n - 1, k - 1);
    _A.set(key, v);
  }
  return v;
}
