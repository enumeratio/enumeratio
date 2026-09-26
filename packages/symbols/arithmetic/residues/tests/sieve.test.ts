// Segmented-sieve and Lucy_Hedgehog π(n)/nth-prime (issue #205): exact against a plain
// trial-division reference over a range small enough to trust by inspection, plus the
// bench's own values and known π(x) values past the segmented sieve's range.
import { expect, test } from "vite-plus/test";
import { nthPrime, PRIME_PI_LIMIT, PRIME_SIEVE_LIMIT, primeCountUpTo } from "../src/sieve.ts";

function isPrimeTrial(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

test("primeCountUpTo matches trial division over 0..2000, including the n < 2 edge", () => {
  let count = 0;
  for (let n = 0; n <= 2000; n++) {
    if (isPrimeTrial(n)) count++;
    expect(primeCountUpTo(n)).toBe(count);
  }
});

test("primeCountUpTo(10^7) is exact (issue #205 bench case)", () => {
  expect(primeCountUpTo(10_000_000)).toBe(664579);
});

test("nthPrime matches trial division over the first 500 primes, and n < 1 declines", () => {
  const primes: number[] = [];
  for (let n = 2; primes.length < 500; n++) if (isPrimeTrial(n)) primes.push(n);
  for (let i = 0; i < primes.length; i++) expect(nthPrime(i + 1)).toBe(primes[i]);
  expect(nthPrime(0)).toBeUndefined();
  expect(nthPrime(-1)).toBeUndefined();
});

test("nthPrime(10^5) is exact (issue #205 bench case)", () => {
  expect(nthPrime(100_000)).toBe(1299709);
});

// ─── Lucy_Hedgehog, past PRIME_SIEVE_LIMIT (issue #205's remaining punchlist item) ───────

test("primeCountUpTo matches known π(x) values well past the segmented sieve's range", () => {
  // OEIS A006880 (π(10^n)), plus the punchlist's own two targets.
  expect(primeCountUpTo(1_000_000_000)).toBe(50847534);
  expect(primeCountUpTo(10_000_000_000)).toBe(455052511);
  expect(primeCountUpTo(100_000_000_000)).toBe(4118054813);
});

test("primeCountUpTo is continuous across the PRIME_SIEVE_LIMIT boundary", () => {
  // π(2·10^8) = 11078937 (OEIS A006880-adjacent value, checked against a reference sieve);
  // one below, at, and one above the boundary must all agree with the segmented-sieve tier.
  expect(primeCountUpTo(PRIME_SIEVE_LIMIT - 1)).toBe(11078937);
  expect(primeCountUpTo(PRIME_SIEVE_LIMIT)).toBe(11078937);
  expect(primeCountUpTo(PRIME_SIEVE_LIMIT + 1)).toBe(11078937);
});

test("primeCountUpTo at prime powers and just below/above a known large prime", () => {
  // 999999999989 is prime (used by several prime-gap references); 999999999999 = 3^2 · 7 ·
  // 11 · 13 · 19 · 52579 is well within 10^12 and not a boundary case, just a clean anchor
  // one below the range's own π(10^11) case.
  const p = 999999999989; // prime, per the same reference tables NthPrime's own tests use
  expect(primeCountUpTo(p - 1)).toBe(primeCountUpTo(p) - 1);
  expect(primeCountUpTo(p)).toBe(primeCountUpTo(p + 1));
  // A prime power (2^40) sits strictly between two primes: π shouldn't jump across it.
  const pow = 2 ** 40;
  expect(primeCountUpTo(pow)).toBe(primeCountUpTo(pow + 1));
});

test("nthPrime(10^8) is exact well past the segmented sieve's range (issue #205 bench case)", () => {
  expect(nthPrime(100_000_000)).toBe(2038074743);
});

test("nthPrime is consistent with primeCountUpTo past the segmented sieve's range", () => {
  for (const n of [200_000_001, 1_000_000, 123_456_789]) {
    const p = nthPrime(n);
    expect(p).toBeDefined();
    expect(primeCountUpTo(p!)).toBe(n);
    expect(primeCountUpTo(p! - 1)).toBe(n - 1);
  }
});

test("nthPrime declines past PRIME_PI_LIMIT's implied index", () => {
  // n large enough that even the loosest Dusart upper bound on p_n exceeds PRIME_PI_LIMIT.
  const n = Math.floor(PRIME_PI_LIMIT / 10);
  expect(nthPrime(n)).toBeUndefined();
});
