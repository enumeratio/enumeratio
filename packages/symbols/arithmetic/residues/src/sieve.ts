// Exact prime counting, in two tiers, and the segmented sieve under both.
//
// Small x: a segmented Sieve of Eratosthenes over odd numbers only. A Uint8 window of
// `SEGMENT` bytes (128 KB, resident in L2) is marked by the base primes up to √hi, one segment
// at a time, so memory is O(√hi + SEGMENT) however far the range runs. It also serves the short
// windows nth-prime locates its answer in (nth-prime.ts).
//
// Larger x: Lucy_Hedgehog (a well-known reformulation of Meissel's combinatorial identity as a
// DP over the O(√x) distinct values of ⌊x/i⌋), exact, O(x^(3/4)) time and O(√x) memory. It
// beats the O(x) sieve from about 10^4 (π(10^7) in under a millisecond against ten), so the
// sieve is only the answer below `PRIME_SIEVE_LIMIT`. Past `PRIME_PI_LIMIT` callers decline
// rather than grow the working set; prime-count.ts takes PrimePi further (Deléglise–Rivat).
// Tracked at https://github.com/enumeratio/enumeratio/issues/205.

const SEGMENT = 1 << 17; // odd numbers per segment, one byte each

/** Every prime ≤ n, via a plain (non-segmented) sieve — only ever called with n = √hi. */
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

// Odd primes up to `baseLimit`, kept between calls (nth-prime windows reuse them).
let baseCache: number[] = [];
let baseLimit = 1;

function oddBasePrimes(limit: number): number[] {
  if (limit > baseLimit) {
    baseLimit = Math.max(limit, 1 << 16);
    baseCache = smallPrimes(baseLimit).slice(1);
  }
  return baseCache;
}

function isqrt(n: number): number {
  let r = Math.floor(Math.sqrt(n));
  while ((r + 1) * (r + 1) <= n) r++;
  while (r * r > n) r--;
  return r;
}

/** Marks composites among the odd numbers `lo, lo+2, …` (`size` of them, `lo` odd and ≥ 3) in `seg`. */
function markOdd(seg: Uint8Array, lo: number, size: number, base: readonly number[]): void {
  seg.fill(0, 0, size);
  const hi = lo + 2 * (size - 1);
  for (const p of base) {
    const pp = p * p;
    if (pp > hi) break;
    let m = pp;
    if (pp < lo) {
      m = lo + ((p - (lo % p)) % p); // first multiple of p at or above lo
      if (m % 2 === 0) m += p; // …made odd
    }
    for (let i = (m - lo) / 2; i < size; i += p) seg[i] = 1;
  }
}

/** Calls `visit(lo, size, seg)` for each segment covering the odd numbers in `[lo, hi]`, 3 ≤ lo. */
function eachOddSegment(lo: number, hi: number, visit: (lo: number, size: number, seg: Uint8Array) => void): void {
  if (hi < lo) return;
  const base = oddBasePrimes(isqrt(hi));
  const seg = new Uint8Array(SEGMENT);
  for (let o = lo; o <= hi; o += 2 * SEGMENT) {
    const size = Math.min(SEGMENT, Math.floor((hi - o) / 2) + 1);
    markOdd(seg, o, size, base);
    visit(o, size, seg);
  }
}

/** First odd number ≥ max(lo, 3), and whether 2 lies in `[lo, hi]`. */
function oddStart(lo: number, hi: number): [first: number, hasTwo: boolean] {
  const from = Math.max(lo, 2);
  return [from % 2 === 1 ? Math.max(from, 3) : from + 1, from <= 2 && hi >= 2];
}

/** The number of primes in `[lo, hi]` (inclusive), by the segmented sieve. */
export function countPrimesIn(lo: number, hi: number): number {
  const [first, hasTwo] = oddStart(lo, hi);
  let count = hasTwo ? 1 : 0;
  eachOddSegment(first, hi, (_o, size, seg) => {
    for (let i = 0; i < size; i++) count += 1 - seg[i]!;
  });
  return count;
}

/** The primes in `[lo, hi]` (inclusive), in order, by the segmented sieve. */
export function primesIn(lo: number, hi: number): number[] {
  const [first, hasTwo] = oddStart(lo, hi);
  const primes: number[] = hasTwo ? [2] : [];
  eachOddSegment(first, hi, (o, size, seg) => {
    for (let i = 0; i < size; i++) if (seg[i] === 0) primes.push(o + 2 * i);
  });
  return primes;
}

/** Below this, `primeCountUpTo` sieves; from it, Lucy_Hedgehog is the faster exact count. */
export const PRIME_SIEVE_LIMIT = 20_000;

/**
 * Past this, nth-prime declines (and PrimePi goes on with prime-count.ts) rather than grow
 * Lucy_Hedgehog's O(√x) working set past what's worth keeping resident for an interactive
 * answer — at 10^12 that's two Float64Arrays of about 8MB apiece.
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
export function primeCountLucy(x: number): number {
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
  return limit < PRIME_SIEVE_LIMIT ? countPrimesIn(2, limit) : primeCountLucy(limit);
}
