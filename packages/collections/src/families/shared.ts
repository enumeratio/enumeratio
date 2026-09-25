// Small exact-integer helpers shared by the family kernels (multiply-before-divide).
// Collection-specific DP tables stay in their own pack; only generic helpers live here.

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
