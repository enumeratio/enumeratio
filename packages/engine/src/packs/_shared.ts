// Small numeric helpers shared by the pure-kernel packs. Exact integer arithmetic (multiply-before-divide),
// matching the inlined copies the parallel agents each wrote — the packs import from here instead of
// re-declaring them. Collection-specific DP tables stay in their own pack; only the truly generic helpers live here.

/** C(n,k), exact, 0 outside 0 ≤ k ≤ n. */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return Math.round(c);
}

/** n! (exact JS number up to n = 18). */
export function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** Catalan(n) = C(2n,n)/(n+1). */
export function catalan(n: number): number {
  if (n < 0) return 0;
  return Math.round(binomial(2 * n, n) / (n + 1));
}
