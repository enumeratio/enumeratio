// Small exact-integer helpers shared by the family kernels (multiply-before-divide).
// Collection-specific DP tables stay in their own module; only generic helpers live here.

/** C(n, k) as an Epsil expression, 0 outside 0 ≤ k ≤ n -- for any area's colex or DP-table
 *  digit search (compositions, and reusable by partitions and set-partitions). Compiled Binomial
 *  is undefined outside 0 ≤ k ≤ n (cortex-js/compute-engine#384), where the interpreter returns
 *  0: a colex digit search's Binomial(c, i) at c = i − 1, or a count's Binomial(n − 1, −1) at
 *  k = 0, both land exactly in that gap. */
export const guardedBinomial = (n: unknown, k: unknown): unknown => [
  "If",
  ["And", ["LessEqual", 0, k], ["LessEqual", k, n]],
  ["Binomial", n, k],
  0,
];

/** C(n, k), exact, 0 outside 0 ≤ k ≤ n. */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let c = 1;
  for (let i = 0; i < kk; i++) c = (c * (n - i)) / (i + 1);
  return Math.round(c);
}

/** n! (exact JS number up to n = 18). */
export function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** Catalan(n) = C(2n, n) / (n + 1). */
export function catalanNumber(n: number): number {
  if (n < 0) return 0;
  return Math.round(binomial(2 * n, n) / (n + 1));
}
