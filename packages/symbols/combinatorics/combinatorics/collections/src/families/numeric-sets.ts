// Spike: four numeric sets/sequences as NumberKernel "scalar" entries (element = a single
// integer, not a list). Proves out kind:"scalar" / paramCount:0 in declare.ts against a mix
// of a sieve-backed value (Primes), a closed form (SquareNumbers), a predicate scan
// (AbundantNumbers), and a one-parameter operator (SmoothNumbers(k)) — not the full 88-set
// catalogue; see design/rendering-environments-planning or the spike report for the rest.
import { isPrime as isPrimeBig, nthPrime as sieveNthPrime, primeCountUpTo } from "@enumeratio/residues";
import type { Declared, NumberKernel } from "./types.ts";

// ---- Primes: the segmented sieve/BPSW primality of @enumeratio/residues (issue #205's
// nth-prime work) — no separate sieve of our own to keep in sync with it. ----

/** The k-th prime (1-indexed). */
function nthPrime(k: number): number {
  const p = sieveNthPrime(k);
  if (p === undefined) throw new RangeError(`nthPrime: ${k} past PRIME_SIEVE_LIMIT`);
  return p;
}

/** Baillie–PSW: exact for any size, not bounded by a sieve limit. */
function isPrime(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && isPrimeBig(BigInt(n));
}

/** 0-indexed rank of a prime (its position in the sequence), or -1 if not prime. π(n) − 1
 *  for a prime n is its rank; the segmented sieve answers π exactly and fast. */
function primeRank(n: number): number {
  return isPrime(n) ? primeCountUpTo(n) - 1 : -1;
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

/** An infinite numeric set: `unrank` by `cost`, membership by a predicate. */
const numeric = (cost: Declared["cost"]["unrank"], rest: Partial<Declared> = {}): Declared => ({
  carrier: "Numeric",
  params: [],
  cost: { count: "closed", unrank: cost, rank: cost, valid: "polynomial" },
  ...rest,
});

export const entries: NumberKernel[] = [
  {
    head: "Primes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => nthPrime(r + 1),
    valid: (element) => isPrime(Number(element)),
    rank: (element) => primeRank(Number(element)),
    declared: numeric("scan"),
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
    declared: numeric("closed"),
  },
  {
    head: "AbundantNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => abundantCache.nth(r + 1),
    valid: (element) => isAbundant(Number(element)),
    rank: (element) => abundantCache.rankOf(Number(element)),
    declared: numeric("scan"),
  },
  {
    head: "SmoothNumbers",
    paramCount: 1,
    kind: "scalar",
    // Below k = 2 no prime qualifies, so the set is just {1}: finite, and a scan for its
    // second element would never end.
    count: ([k]) => (k < 2 ? 1 : Number.POSITIVE_INFINITY),
    unrank: ([k], r) => (k < 2 ? (r === 0 ? 1 : Number.NaN) : smoothCacheFor(k).nth(r + 1)),
    valid: (element, [k]) => isKSmooth(Number(element), k),
    rank: (element, [k]) => smoothCacheFor(k).rankOf(Number(element)),
    declared: numeric("scan", {
      params: [{ name: "k", role: "param", min: 0 }],
      // k-smooth numbers thin out fast for small k (the 2-smooth are the powers of 2), and
      // the scan pays for every integer up to the value: keep the ranks where values stay small.
      sized: ([k], size) => BigInt(Math.min(size, (k as number) < 3 ? 16 : (k as number) < 5 ? 60 : size)),
    }),
  },
];
