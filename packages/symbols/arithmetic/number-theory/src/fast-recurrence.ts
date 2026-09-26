// Fast doubling for Fibonacci/Lucas: O(log n) bigint multiplications instead of compute-
// engine's native O(n) additions. `pair(n)` returns [F(n), F(n+1)] for n ≥ 0 via the
// doubling identities
//   F(2k)   = F(k)·(2·F(k+1) − F(k))
//   F(2k+1) = F(k)² + F(k+1)²
// and LucasL(n) = 2·F(n+1) − F(n) (check: n=0 → 2·1−0 = 2 ✓, n=1 → 2·1−1 = 1 ✓).
//
// The `mod` variants thread a modulus through every intermediate step, so a call reduced
// mod p (`Mod(Fibonacci(n), p)`) never builds the unreduced, ~n·log₁₀(φ)-digit integer —
// every value stays word-sized. Both negative-index conventions match compute-engine's own
// native heads (and Wolfram's): F(−n) = (−1)ⁿ⁺¹·F(n), L(−n) = (−1)ⁿ·L(n).

/** [F(n), F(n+1)] for n ≥ 0, plain bigint arithmetic (no reduction). */
function fibPair(n: bigint): [bigint, bigint] {
  if (n === 0n) return [0n, 1n];
  const [a, b] = fibPair(n >> 1n);
  const c = a * (2n * b - a);
  const d = a * a + b * b;
  return n % 2n === 0n ? [c, d] : [d, c + d];
}

const modOf = (a: bigint, m: bigint): bigint => {
  const r = a % m;
  return r < 0n ? r + m : r;
};

/** [F(n) mod m, F(n+1) mod m] for n ≥ 0, m > 0 — every intermediate value reduced. */
function fibPairMod(n: bigint, m: bigint): [bigint, bigint] {
  if (n === 0n) return [0n, 1n % m];
  const [a, b] = fibPairMod(n >> 1n, m);
  const c = modOf(a * modOf(2n * b - a, m), m);
  const d = modOf(a * a + b * b, m);
  return n % 2n === 0n ? [c, d] : [d, modOf(c + d, m)];
}

/** F(n), exact, for any bigint n (negative indices via F(−n) = (−1)ⁿ⁺¹ F(n)). */
export function fibonacci(n: bigint): bigint {
  const negative = n < 0n;
  const magnitude = negative ? -n : n;
  const [value] = fibPair(magnitude);
  return negative && magnitude % 2n === 0n ? -value : value;
}

/** LucasL(n), exact, for any bigint n (negative indices via L(−n) = (−1)ⁿ L(n)). */
export function lucasL(n: bigint): bigint {
  const negative = n < 0n;
  const magnitude = negative ? -n : n;
  const [a, b] = fibPair(magnitude);
  const value = 2n * b - a;
  return negative && magnitude % 2n === 1n ? -value : value;
}

/** F(n) mod m, for any bigint n and m > 0. */
export function fibonacciMod(n: bigint, m: bigint): bigint {
  const negative = n < 0n;
  const magnitude = negative ? -n : n;
  const [value] = fibPairMod(magnitude, m);
  return negative && magnitude % 2n === 0n ? modOf(-value, m) : value;
}

/** LucasL(n) mod m, for any bigint n and m > 0. */
export function lucasLMod(n: bigint, m: bigint): bigint {
  const negative = n < 0n;
  const magnitude = negative ? -n : n;
  const [a, b] = fibPairMod(magnitude, m);
  const value = modOf(2n * b - a, m);
  return negative && magnitude % 2n === 1n ? modOf(-value, m) : value;
}
