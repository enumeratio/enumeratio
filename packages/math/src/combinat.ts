// Core combinatorial counting primitives. Ported from ~/Playground/ideas/numbers/src/combinat.ts, renamed to
// match their SQL twins exactly:
//   numbers-repo name        →  SQL name (file)
//   factorial                →  factorial (utilities.sql)
//   binomial                 →  binomial (utilities.sql)
//   bell                     →  bell (set_partitions.sql)
//   fubini                   →  fubini (set_compositions.sql)
//   partitionCount           →  partition_number (integer_partitions.sql)
//   (stirling2, new name)    →  stirling_second (set_partitions_into_k_blocks.sql)
// catalan_number lives in ./catalan.ts alongside little_schroder_number (both from catalan.ts's family).

/** SQL twin: factorial(n int) — n!. Returned as a JS number (exact up to n=18; beyond that use factorial_bigint). */
export function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** SQL twin: factorial_bigint(n int) — exact bigint form; matches factorial() for n ≤ 20 (int8 domain). */
export function factorial_bigint(n: number): bigint {
  let f = 1n;
  for (let i = 2; i <= n; i++) f *= BigInt(i);
  return f;
}

/** SQL twin: binomial(n int, k int) — C(n,k), multiplicative form, 0 outside 0 ≤ k ≤ n. */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return Math.round(c);
}

/** SQL twin: binomial_bigint(n int, k int) — interleaved product/quotient, no rounding needed (exact each step). */
export function binomial_bigint(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  k = Math.min(k, n - k);
  let c = 1n;
  for (let i = 0; i < k; i++) c = (c * BigInt(n - i)) / BigInt(i + 1);
  return c;
}

// Bell numbers B(n) = #set partitions of [n], via the Bell triangle (each row's first entry is B(n)).
/** SQL twin: bell(n int) — set_partitions.sql. */
export function bell(n: number): number {
  if (n <= 0) return 1;
  let row = [1];
  for (let i = 1; i <= n; i++) {
    const next = [row[row.length - 1]];
    for (let j = 0; j < row.length; j++) next.push(next[j] + row[j]);
    row = next;
  }
  return row[0];
}

// Fubini / ordered Bell numbers a(n) = #set compositions of [n], via a(n) = Σ_k C(n,k)·a(n−k).
/** SQL twin: fubini(n int) — set_compositions.sql. */
export function fubini(n: number): number {
  const a = [1];
  for (let m = 1; m <= n; m++) {
    let s = 0;
    for (let k = 1; k <= m; k++) s += binomial(m, k) * a[m - k];
    a[m] = s;
  }
  return a[n];
}

// Stirling numbers of the second kind S(n,k) = #set partitions of [n] into exactly k blocks.
// Recurrence: S(n,k) = k·S(n-1,k) + S(n-1,k-1); S(0,0) = 1.
const _stirling2 = new Map<string, number>();
/** SQL twin: stirling_second(n int, k int) — set_partitions_into_k_blocks.sql. */
export function stirling_second(n: number, k: number): number {
  if (n === 0) return k === 0 ? 1 : 0;
  if (k <= 0 || k > n) return 0;
  const key = `${n},${k}`;
  let v = _stirling2.get(key);
  if (v === undefined) {
    v = k * stirling_second(n - 1, k) + stirling_second(n - 1, k - 1);
    _stirling2.set(key, v);
  }
  return v;
}

// Partition number p(n) = #integer partitions of n, via Euler's pentagonal-number recurrence.
/** SQL twin: partition_number(n int) — integer_partitions.sql. */
export function partition_number(n: number): number {
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
