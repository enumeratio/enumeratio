// Segmented-sieve and Lucy_Hedgehog π(n)/nth-prime (issue #205): exact against a plain
// trial-division reference over a range small enough to trust by inspection, plus the
// bench's own values and known π(x) values past the sieve's range.
import { expect, test } from "vite-plus/test";
import { nthPrime } from "../src/nth-prime.ts";
import {
  countPrimesIn,
  PRIME_PI_LIMIT,
  PRIME_SIEVE_LIMIT,
  primeCountLucy,
  primeCountUpTo,
  primesIn,
} from "../src/sieve.ts";

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

test("primeCountUpTo matches known π(x) values well past the sieve's range", () => {
  // OEIS A006880 (π(10^n)), plus the punchlist's own two targets.
  expect(primeCountUpTo(1_000_000_000)).toBe(50847534);
  expect(primeCountUpTo(10_000_000_000)).toBe(455052511);
  expect(primeCountUpTo(100_000_000_000)).toBe(4118054813);
});

test("the sieve and Lucy_Hedgehog agree around PRIME_SIEVE_LIMIT and well above it", () => {
  for (const x of [PRIME_SIEVE_LIMIT - 1, PRIME_SIEVE_LIMIT, PRIME_SIEVE_LIMIT + 1, 262_144, 1_000_003, 25_000_000]) {
    expect(primeCountLucy(x)).toBe(countPrimesIn(2, x));
  }
});

test("segmented sieve ranges: arbitrary windows, segment seams, 2, and empty ranges", () => {
  expect(primesIn(0, 30)).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  expect(primesIn(2, 2)).toEqual([2]);
  expect(primesIn(3, 3)).toEqual([3]);
  expect(primesIn(24, 28)).toEqual([]);
  expect(primesIn(10, 5)).toEqual([]);
  // Straddles several 2^18-number segments.
  const lo = 1_000_000_007;
  const hi = lo + 1_500_000;
  expect(countPrimesIn(lo, hi)).toBe(primeCountLucy(hi) - primeCountLucy(lo - 1));
  expect(primesIn(lo, hi).length).toBe(countPrimesIn(lo, hi));
});

test("primeCountUpTo just below and above a large prime, and across a prime power", () => {
  const p = 99_999_999_977; // the largest prime below 10^11
  expect(isPrimeTrial(p)).toBe(true);
  expect(primeCountUpTo(p - 1)).toBe(primeCountUpTo(p) - 1);
  expect(primeCountUpTo(p)).toBe(primeCountUpTo(p + 1));
  // A prime power sits strictly between two primes: π shouldn't jump across it.
  const pow = 2 ** 36;
  expect(primeCountUpTo(pow)).toBe(primeCountUpTo(pow + 1));
});

test("nthPrime(10^8) is exact well past the sieve's range (issue #205 bench case)", () => {
  expect(nthPrime(100_000_000)).toBe(2038074743);
});

test("nthPrime is consistent with primeCountUpTo past the sieve's range", () => {
  for (const n of [200_000_001, 1_000_000, 123_456_789]) {
    const p = nthPrime(n);
    expect(p).toBeDefined();
    expect(primeCountUpTo(p!)).toBe(n);
    expect(primeCountUpTo(p! - 1)).toBe(n - 1);
  }
});

test("nthPrime declines past PRIME_PI_LIMIT's implied index", () => {
  // p_n for n = 10^11 is about 2.8·10^12, well past PRIME_PI_LIMIT.
  const n = Math.floor(PRIME_PI_LIMIT / 10);
  expect(nthPrime(n)).toBeUndefined();
});

test("nthPrime answers right up to PRIME_PI_LIMIT, then declines", () => {
  expect(nthPrime(37_607_912_018)).toBe(999_999_999_989); // π(10^12), the last prime below the limit
  expect(nthPrime(37_607_912_019)).toBeUndefined(); // 1_000_000_000_039
});

test("π(10^k) for k ≤ 9 (OEIS A006880), through the public count", () => {
  const known = [4, 25, 168, 1229, 9592, 78498, 664579, 5761455, 50847534];
  known.forEach((count, i) => expect(primeCountUpTo(10 ** (i + 1))).toBe(count));
});

test("p_(10^k) for k ≤ 10 (OEIS A006988), through the table and the counted path", () => {
  const known = [29, 541, 7919, 104729, 1299709, 15485863, 179424673, 2038074743, 22801763489, 252097800623];
  known.forEach((p, i) => expect(nthPrime(10 ** (i + 1))).toBe(p));
});

test("nthPrime is exact across the table boundary and agrees with the sieve around it", () => {
  const primes = primesIn(900_000, 1_100_000);
  const before = countPrimesIn(2, 899_999);
  for (let i = 0; i < primes.length; i += 97) expect(nthPrime(before + i + 1)).toBe(primes[i]);
  expect(nthPrime(78_498)).toBe(999_983);
  expect(nthPrime(78_499)).toBe(1_000_003);
});
