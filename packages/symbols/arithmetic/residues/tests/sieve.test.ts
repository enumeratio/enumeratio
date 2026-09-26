// Segmented-sieve π(n)/nth-prime (issue #205): exact against a plain trial-division
// reference over a range small enough to trust by inspection, plus the bench's own values.
import { expect, test } from "vite-plus/test";
import { nthPrime, primeCountUpTo } from "../src/sieve.ts";

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
