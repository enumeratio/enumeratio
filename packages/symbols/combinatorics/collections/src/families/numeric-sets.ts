// Spike: four numeric sets/sequences as FamilyKernel "scalar" entries (element = a single
// integer, not a list). Proves out kind:"scalar" / paramCount:0 in declare.ts against a mix
// of a sieve-backed value (Primes), a closed form (SquareNumbers), a predicate scan
// (AbundantNumbers), and a one-parameter operator (SmoothNumbers(k)) — not the full 88-set
// catalogue; see design/rendering-environments-planning or the spike report for the rest.
import type { FamilyKernel } from "./types.ts";

// ---- Primes: incremental sieve, grown on demand and cached across calls. ----

let sievePrimes: number[] = [2, 3];
let sieveLimit = 3;

function growSieveTo(limit: number): void {
  if (limit <= sieveLimit) return;
  const isComposite = new Uint8Array(limit + 1);
  const primes: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (isComposite[i]) continue;
    primes.push(i);
    for (let j = i * i; j <= limit; j += i) isComposite[j] = 1;
  }
  sievePrimes = primes;
  sieveLimit = limit;
}

/** The k-th prime (1-indexed): grow the sieve past a prime-counting estimate, doubling
 *  until it's actually reached (the estimate can undershoot for small k). */
function nthPrime(k: number): number {
  let bound = Math.max(16, Math.ceil(k * (Math.log(k + 1) + Math.log(Math.log(k + 2) + 1)) * 1.2));
  growSieveTo(bound);
  while (sievePrimes.length < k) {
    bound *= 2;
    growSieveTo(bound);
  }
  return sievePrimes[k - 1];
}

function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n <= sieveLimit) return sievePrimes.includes(n);
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

/** 0-indexed rank of a prime (its position in the sequence), or -1 if not prime. */
function primeRank(n: number): number {
  if (!isPrime(n)) return -1;
  growSieveTo(n);
  return sievePrimes.indexOf(n);
}

// ---- shared: memoised "nth n with predicate(n)" scan, for families with no closed form. ----

/** Grows a cache of matches as higher ranks or values are requested, so repeated At/rank
 *  queries against the same predicate don't rescan from 1 every time. */
function nthMatchCache(predicate: (n: number) => boolean) {
  const matches: number[] = [];
  let scanned = 0;
  const extendTo = (count: number) => {
    while (matches.length < count) {
      scanned++;
      if (predicate(scanned)) matches.push(scanned);
    }
  };
  return {
    /** The k-th match (1-indexed). */
    nth: (k: number): number => {
      extendTo(k);
      return matches[k - 1];
    },
    /** 0-indexed rank of `value`, or -1 if it isn't a match. */
    rankOf: (value: number): number => {
      if (!Number.isInteger(value) || value < 1) return -1;
      while (scanned < value) {
        scanned++;
        if (predicate(scanned)) matches.push(scanned);
      }
      return matches.indexOf(value);
    },
  };
}

// ---- AbundantNumbers: sigma(n) (sum of proper divisors) > n. A005101: 12, 18, 20, 24, ... ----

function sumProperDivisors(n: number): number {
  if (n <= 1) return 0;
  let sum = 1;
  for (let d = 2; d * d <= n; d++) {
    if (n % d !== 0) continue;
    sum += d;
    const cofactor = n / d;
    if (cofactor !== d) sum += cofactor;
  }
  return sum;
}

const isAbundant = (n: number): boolean => n >= 1 && sumProperDivisors(n) > n;
const abundantCache = nthMatchCache(isAbundant);

// ---- SmoothNumbers(k): every prime factor of n is <= k (1 counts, vacuously). One cache per k. ----

function isKSmooth(n: number, k: number): boolean {
  if (n < 1) return false;
  let m = n;
  for (let p = 2; p <= k && p <= m; p++) {
    while (m % p === 0) m /= p;
  }
  return m === 1;
}

const smoothCaches = new Map<number, ReturnType<typeof nthMatchCache>>();
function smoothCacheFor(k: number): ReturnType<typeof nthMatchCache> {
  let cache = smoothCaches.get(k);
  if (!cache) {
    cache = nthMatchCache((n) => isKSmooth(n, k));
    smoothCaches.set(k, cache);
  }
  return cache;
}

export const entries: FamilyKernel[] = [
  {
    head: "Primes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => nthPrime(r + 1),
    valid: (element) => isPrime(Number(element)),
    rank: (element) => primeRank(Number(element)),
  },
  {
    head: "SquareNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => (r + 1) * (r + 1),
    valid: (element) => {
      const n = Number(element);
      const root = Math.sqrt(n);
      return Number.isInteger(root) && root >= 1;
    },
    rank: (element) => {
      const n = Number(element);
      const root = Math.sqrt(n);
      return Number.isInteger(root) && root >= 1 ? root - 1 : -1;
    },
  },
  {
    head: "AbundantNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => abundantCache.nth(r + 1),
    valid: (element) => isAbundant(Number(element)),
    rank: (element) => abundantCache.rankOf(Number(element)),
  },
  {
    head: "SmoothNumbers",
    paramCount: 1,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: ([k], r) => smoothCacheFor(k).nth(r + 1),
    valid: (element, [k]) => isKSmooth(Number(element), k),
    rank: (element, [k]) => smoothCacheFor(k).rankOf(Number(element)),
  },
];
