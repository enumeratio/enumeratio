// Exact prime counting and nth-prime over plain (safe-integer) bounds, via a segmented
// Sieve of Eratosthenes: small primes up to √limit mark composites block by block, so
// memory stays O(√limit + block size) instead of O(limit) for one giant sieve. Fast enough
// for PrimePi/NthPrime's bench range (PrimePi(10^7) in milliseconds, not seconds); past
// `PRIME_SIEVE_LIMIT` this declines rather than pretend a Meissel–Lehmer count it doesn't
// have — see the punchlist issue for that as a follow-up past this range.

const BLOCK_SIZE = 1 << 20; // 1,048,576 — big enough to amortize the per-block overhead

/** Every prime ≤ n, via a plain (non-segmented) sieve — only ever called with n = √limit. */
function smallPrimes(n: number): number[] {
  if (n < 2) return [];
  const composite = new Uint8Array(n + 1);
  const primes: number[] = [];
  for (let i = 2; i <= n; i++) {
    if (composite[i]) continue;
    primes.push(i);
    for (let j = i * i; j <= n; j += i) composite[j] = 1;
  }
  return primes;
}

/** Sieve `[low, high]` (inclusive) against `basePrimes`, calling `onPrime` for every survivor. */
function sieveBlock(low: number, high: number, basePrimes: readonly number[], onPrime: (value: number) => void): void {
  const size = high - low + 1;
  const composite = new Uint8Array(size);
  for (const p of basePrimes) {
    if (p * p > high) break;
    const start = Math.max(p * p, Math.ceil(low / p) * p);
    for (let j = start; j <= high; j += p) composite[j - low] = 1;
  }
  const from = Math.max(low, 2);
  for (let value = from; value <= high; value++) {
    if (!composite[value - low]) onPrime(value);
  }
}

/** Past this, PrimePi/NthPrime decline exactly (stay symbolic) rather than sieve for minutes. */
export const PRIME_SIEVE_LIMIT = 200_000_000;

/** π(limit): the count of primes ≤ limit, exact. `limit` must be a safe non-negative integer. */
export function primeCountUpTo(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 2) return 0;
  const basePrimes = smallPrimes(Math.floor(Math.sqrt(limit)));
  let count = 0;
  for (let low = 2; low <= limit; low += BLOCK_SIZE) {
    const high = Math.min(low + BLOCK_SIZE - 1, limit);
    sieveBlock(low, high, basePrimes, () => count++);
  }
  return count;
}

/** Every prime in `[2, limit]`, in order. Only used past the first few primes (see `nthPrime`). */
function primesUpTo(limit: number): number[] {
  const basePrimes = smallPrimes(Math.floor(Math.sqrt(limit)));
  const primes: number[] = [];
  for (let low = 2; low <= limit; low += BLOCK_SIZE) {
    const high = Math.min(low + BLOCK_SIZE - 1, limit);
    sieveBlock(low, high, basePrimes, (value) => primes.push(value));
  }
  return primes;
}

const FIRST_FIVE_PRIMES = [2, 3, 5, 7, 11];

/**
 * The nth prime (1-based): `nthPrime(1)` is 2. Sieves up to an upper bound from the
 * Rosser–Schoenfeld / Dusart estimate `p_n < n·(ln n + ln ln n)` (valid for n ≥ 6, padded
 * for safety margin), then reads off the nth entry — one sieve pass, no guessing loop.
 * `undefined` past `PRIME_SIEVE_LIMIT`'s implied index, or for n < 1.
 */
export function nthPrime(n: number): number | undefined {
  if (!Number.isSafeInteger(n) || n < 1) return undefined;
  if (n <= FIRST_FIVE_PRIMES.length) return FIRST_FIVE_PRIMES[n - 1];
  const ln = Math.log(n);
  const lnln = Math.log(ln);
  // Dusart (2010): p_n < n (ln n + ln ln n) for n ≥ 6. 20% headroom covers the estimate's
  // slack at smaller n without materially changing the sieve's cost.
  const bound = Math.ceil(n * (ln + lnln) * 1.2) + 20;
  if (bound > PRIME_SIEVE_LIMIT) return undefined;
  const primes = primesUpTo(bound);
  // The bound is a proven upper limit for n ≥ 6, so this should never come up short —
  // but a belt-and-suspenders re-sieve at double the bound costs nothing at n this size.
  if (primes.length < n) {
    const wider = primesUpTo(Math.min(bound * 2, PRIME_SIEVE_LIMIT));
    return wider[n - 1];
  }
  return primes[n - 1];
}
