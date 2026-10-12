// The permutations of n with no increasing run of 4 (A005802), by Gessel's theorem: Σ u(n) x^n / n!² is the
// 3 × 3 Toeplitz determinant of the Bessel functions I_{|i − j|}(2√x), I₀³ − 2 I₀ I₁² + 2 I₁² I₂ − I₀ I₂², here
// in integer series scaled by (top!)². Vexillary permutations (Av(2143)) are counted the same.

const factorial = (n: number): bigint => (n <= 1 ? 1n : BigInt(n) * factorial(n - 1));

/** u(0) … u(top). */
export function gesselAv1234(top: number): bigint[] {
  const range = Array.from({ length: top + 1 }, (_, i) => i);
  const scale = factorial(top) ** 2n;
  const series = (k: number): bigint[] => range.map((m) => scale / (factorial(m) * factorial(m + k)));
  const product = (p: bigint[], q: bigint[]): bigint[] => {
    const out: bigint[] = Array(top + 1).fill(0n);
    for (let i = 0; i <= top; i++) for (let j = 0; i + j <= top; j++) out[i + j] += p[i] * q[j];
    return out;
  };
  const shifted = (p: bigint[], by: number): bigint[] => p.map((_, i) => (i >= by ? p[i - by] : 0n));
  const [a, b, c] = [series(0), series(1), series(2)];
  const [b2, c2] = [product(b, b), product(c, c)];
  const terms = [
    product(product(a, a), a),
    shifted(product(a, b2), 1).map((x) => -2n * x),
    shifted(product(b2, c), 2).map((x) => 2n * x),
    shifted(product(a, c2), 2).map((x) => -x),
  ];
  return range.map((n) => (terms.reduce((sum, t) => sum + t[n], 0n) * factorial(n) ** 2n) / scale ** 3n);
}
