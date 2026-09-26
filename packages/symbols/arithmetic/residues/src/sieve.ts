// Exact prime counting and nth-prime, in two tiers.
//
// Below `PRIME_SIEVE_LIMIT`, a segmented Sieve of Eratosthenes: small primes up to √limit
// mark composites block by block, so memory stays O(√limit + block size) instead of O(limit)
// for one giant sieve. Fast enough for PrimePi/NthPrime's smaller bench range
// (PrimePi(10^7) in milliseconds), but an O(n) pass doesn't reach the 10^9/10^11 tiers in
// anything but minutes.
//
// Above it, up to `PRIME_PI_LIMIT`, the Lucy_Hedgehog method (a well-known reformulation of
// Meissel's combinatorial identity as a DP over the O(√x) distinct values of ⌊x/i⌋): still
// exact, and its O(x^(3/4)) time with O(√x) memory reaches PrimePi(10^11) in a few hundred
// milliseconds — see `primeCountLarge` below for the algorithm. NthPrime past the sieve
// range brackets with Dusart's bounds on p_n, counts with the same method to locate the
// bracket precisely, then segment-sieves that (short) interval for the exact prime — see
// `nthPrimeLarge`.
//
// Past `PRIME_PI_LIMIT` both decline (stay symbolic) rather than let the √x working set grow
// past what's worth keeping in memory for an interactive answer — see the punchlist issue
// (#205) for Meissel–Lehmer's further pruning of the small-prime table as a follow-up.

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

/** Below this, the plain segmented sieve above answers PrimePi/NthPrime directly. */
export const PRIME_SIEVE_LIMIT = 200_000_000;

/**
 * Past this, PrimePi/NthPrime decline exactly (stay symbolic) rather than grow the
 * Lucy_Hedgehog method's O(√x) working set past what's worth keeping resident for an
 * interactive answer — at 10^12 that's two Float64Arrays of about 8MB apiece, comfortably
 * under a gigabyte with room to spare for whatever else is running.
 */
export const PRIME_PI_LIMIT = 1_000_000_000_000;

/** ⌊n/d⌋ for non-negative n, d, correctly rounded even where float division's own rounding
 *  would land exactly on an integer boundary from the wrong side (only possible this close
 *  to 2^53, but `PRIME_PI_LIMIT` sits close enough to be worth the one extra comparison). */
function idiv(n: number, d: number): number {
  let q = Math.floor(n / d);
  if (q * d > n) q--;
  else if ((q + 1) * d <= n) q++;
  return q;
}

/**
 * π(x) by the Lucy_Hedgehog method: a DP over the O(√x) distinct values of ⌊x/i⌋, applying
 * Meissel's identity — sieving out multiples of each prime p ≤ √x updates every tracked value
 * at once — in O(x^(3/4)) time in exchange for that memory. `smaller[i]` holds the running
 * π(i) for the small values i ≤ √x; `larger[i]` holds π(⌊x/i⌋) for the same range, which is
 * every large value ⌊x/i⌋ can take. `larger[1] = π(x)` once every prime ≤ √x has sieved.
 */
function primeCountLarge(x: number): number {
  if (x < 2) return 0;
  let sq = Math.floor(Math.sqrt(x));
  while ((sq + 1) * (sq + 1) <= x) sq++;
  while (sq * sq > x) sq--;
  const smaller = new Float64Array(sq + 1);
  const larger = new Float64Array(sq + 1);
  for (let i = 1; i <= sq; i++) {
    smaller[i] = i - 1;
    larger[i] = idiv(x, i) - 1;
  }
  for (let p = 2; p <= sq; p++) {
    if (smaller[p] === smaller[p - 1]) continue; // p composite: sieved out already
    const countBelowP = smaller[p - 1];
    const p2 = p * p;
    // Every large value v = ⌊x/i⌋ ≥ p² needs p's multiples removed; smaller ones already
    // have every prime factor ≤ √v < p accounted for.
    const limit = Math.min(sq, idiv(x, p2));
    for (let i = 1; i <= limit; i++) {
      const d = i * p;
      larger[i] -= (d <= sq ? larger[d] : smaller[idiv(x, d)]) - countBelowP;
    }
    // Downward so `smaller[i / p]` (i / p < i, since p ≥ 2) is still last cycle's value.
    for (let i = sq; i >= p2; i--) {
      smaller[i] -= smaller[idiv(i, p)] - countBelowP;
    }
  }
  return larger[1];
}

/** π(limit): the count of primes ≤ limit, exact. `limit` must be a safe non-negative integer;
 *  past `PRIME_PI_LIMIT` this keeps computing (Lucy_Hedgehog has no hard ceiling) but without
 *  the memory guarantee above — callers gate on `PRIME_PI_LIMIT` for that. */
export function primeCountUpTo(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 2) return 0;
  if (limit > PRIME_SIEVE_LIMIT) return primeCountLarge(limit);
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
 * A [lo, hi] bracket certain to contain p_n, from Dusart's 2010 bounds on the nth prime —
 * tight ones (Theorem 5.15, valid n ≥ 688383) where n is large enough for the tightness to
 * matter for the sieve interval that follows, the older, looser `n(ln n + ln ln n)` shape
 * with generous padding otherwise (cheap to sieve either way at these n). A relative pad on
 * top covers this being a recollection of the literature rather than a re-derivation: the
 * `expandBracket` guard below is the actual correctness backstop.
 */
function dusartBracket(n: number): [number, number] {
  const ln = Math.log(n);
  const lnln = Math.log(ln);
  let lo: number;
  let hi: number;
  if (n >= 688383) {
    lo = n * (ln + lnln - 1 + (lnln - 2.1) / ln);
    hi = n * (ln + lnln - 1 + (lnln - 2) / ln);
  } else {
    hi = n * (ln + lnln) * 1.2 + 20;
    lo = Math.max(2, n * (ln + lnln - 1) * 0.8 - 20);
  }
  const pad = Math.max(1000, Math.ceil(hi * 0.002));
  return [Math.max(2, Math.floor(lo) - pad), Math.ceil(hi) + pad];
}

/** Nth prime past `PRIME_SIEVE_LIMIT`'s implied index: bracket with Dusart's bounds, count
 *  the bracket's edges with the Lucy_Hedgehog `primeCountLarge` to locate p_n's position
 *  precisely, then segment-sieve that (short) interval for the exact value. `undefined` when
 *  the bracket would run past `PRIME_PI_LIMIT` (documented as this function's own range). */
function nthPrimeLarge(n: number): number | undefined {
  let [lo, hi] = dusartBracket(n);
  // Backstop against the literature recollection above being off in either direction: widen
  // until the bracket demonstrably contains p_n. Never fires for a correct Dusart bound past
  // n ≥ 688383; only exercised (and only once or twice) below that, where the padding is
  // already loose.
  for (let guard = 0; guard < 10 && primeCountLarge(hi) < n; guard++) {
    lo = hi;
    hi = Math.ceil(hi * 1.5) + 1000;
  }
  for (let guard = 0; guard < 10 && lo > 2 && primeCountLarge(lo - 1) >= n; guard++) {
    hi = lo;
    lo = Math.max(2, Math.floor(lo * 0.7));
  }
  if (hi > PRIME_PI_LIMIT) return undefined;
  const before = primeCountLarge(lo - 1); // count of primes strictly below lo
  const need = n - before; // p_n is the `need`-th prime found sieving [lo, hi]
  const basePrimes = smallPrimes(Math.floor(Math.sqrt(hi)) + 1);
  let found = 0;
  for (let low = lo; low <= hi; low += BLOCK_SIZE) {
    const high = Math.min(low + BLOCK_SIZE - 1, hi);
    let answer: number | undefined;
    sieveBlock(low, high, basePrimes, (value) => {
      if (answer === undefined && ++found === need) answer = value;
    });
    if (answer !== undefined) return answer;
  }
  return undefined;
}

/**
 * The nth prime (1-based): `nthPrime(1)` is 2. Below the sieve's implied index range, sieves
 * up to an upper bound from the Rosser–Schoenfeld / Dusart estimate `p_n < n·(ln n + ln ln
 * n)` (valid for n ≥ 6, padded for safety margin), then reads off the nth entry — one sieve
 * pass, no guessing loop. Past that, `nthPrimeLarge` brackets and locates it instead.
 * `undefined` past `PRIME_PI_LIMIT`'s implied index, or for n < 1.
 */
export function nthPrime(n: number): number | undefined {
  if (!Number.isSafeInteger(n) || n < 1) return undefined;
  if (n <= FIRST_FIVE_PRIMES.length) return FIRST_FIVE_PRIMES[n - 1];
  const ln = Math.log(n);
  const lnln = Math.log(ln);
  // Dusart (2010): p_n < n (ln n + ln ln n) for n ≥ 6. 20% headroom covers the estimate's
  // slack at smaller n without materially changing the sieve's cost.
  const bound = Math.ceil(n * (ln + lnln) * 1.2) + 20;
  if (bound > PRIME_SIEVE_LIMIT) return nthPrimeLarge(n);
  const primes = primesUpTo(bound);
  // The bound is a proven upper limit for n ≥ 6, so this should never come up short —
  // but a belt-and-suspenders re-sieve at double the bound costs nothing at n this size.
  if (primes.length < n) {
    const wider = primesUpTo(Math.min(bound * 2, PRIME_SIEVE_LIMIT));
    return wider[n - 1];
  }
  return primes[n - 1];
}
