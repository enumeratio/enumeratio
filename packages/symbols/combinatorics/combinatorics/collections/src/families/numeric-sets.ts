// Spike: four numeric sets/sequences as NumberKernel "scalar" entries (element = a single
// integer, not a list). Proves out kind:"scalar" / paramCount:0 in declare.ts against a mix
// of a sieve-backed value (PrimeNumbers), a closed form (SquareNumbers), a predicate scan
// (AbundantNumbers), and a one-parameter operator (SmoothNumbers(k)) — not the full 88-set
// catalogue; see design/rendering-environments-planning or the spike report for the rest.
import { isPrime as isPrimeBig, nthPrime as sieveNthPrime, primeCountUpTo } from "@enumeratio/residues";
import type { EpsilFamily } from "./epsil.ts";
import { withDefinitions } from "./numeric-definitions.ts";
import { withScanDefinitions } from "./scan-definitions.ts";
import type { Declared, NumberKernel } from "./types.ts";
import { declineWork, factorsOf, matchCache, memoBy, sigmaOf } from "./work.ts";

// ---- PrimeNumbers: the segmented sieve/BPSW primality of @enumeratio/residues (issue #205's
// nth-prime work) — no separate sieve of our own to keep in sync with it. ----

/** The k-th prime (1-indexed). */
function nthPrime(k: number): number {
  const p = sieveNthPrime(k);
  if (p === undefined) return declineWork(`nthPrime: ${k} past PRIME_PI_LIMIT`);
  return p;
}

/** Baillie–PSW: exact for any size, not bounded by a sieve limit. */
function isPrime(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && isPrimeBig(BigInt(n));
}

/** π(n) takes about x^(3/4) steps (measured: a second at 5·10^11), so a rank is answered up to this. */
const PRIME_RANK_LIMIT = 5e11;

/** 0-indexed rank of a prime (its position in the sequence), or -1 if not prime. π(n) − 1
 *  for a prime n is its rank; the segmented sieve answers π exactly and fast. */
function primeRank(n: number): number {
  if (!isPrime(n)) return -1;
  if (n > PRIME_RANK_LIMIT) return declineWork(`the rank of ${n}`);
  return primeCountUpTo(n) - 1;
}

// ---- AbundantNumbers: sigma(n) (sum of proper divisors) > n. A005101: 12, 18, 20, 24, ... ----

/** σ(n) > 2n, σ from the factorisation: exact, and a few steps for any n a double holds. */
const isAbundant = (n: number): boolean => Number.isSafeInteger(n) && n >= 1 && sigmaOf(n) > 2n * BigInt(n);
const abundantCache = matchCache("AbundantNumbers", isAbundant);

// ---- SmoothNumbers(k): every prime factor of n is <= k (1 counts, vacuously). One cache per k. ----

function isKSmooth(n: number, k: number): boolean {
  if (!Number.isSafeInteger(n) || n < 1) return false;
  const factors = factorsOf(n);
  return factors.length === 0 ? true : factors[factors.length - 1][0] <= k;
}

const smoothCaches = new Map<number, ReturnType<typeof matchCache>>();
function smoothCacheFor(k: number): ReturnType<typeof matchCache> {
  return memoBy(smoothCaches, k, () => matchCache("SmoothNumbers", (n) => isKSmooth(n, k)));
}

/** The root of a perfect square, else 0. A float root of a nearby non-square can round to an integer
 *  past 2^52, so the root is checked by squaring it, which a double holds exactly. */
function squareRoot(n: number): number {
  const root = Math.round(Math.sqrt(n));
  return Number.isSafeInteger(n) && root >= 1 && root * root === n ? root : 0;
}

/** An infinite numeric set: `unrank` by `cost`, membership by a predicate. */
const numeric = (cost: Declared["cost"]["unrank"], rest: Partial<Declared> = {}): Declared => ({
  carrier: "Numeric",
  params: [],
  cost: { count: "closed", unrank: cost, rank: cost, valid: "polynomial" },
  ...rest,
});

/** The families as TS kernels: where a family has an Epsil definition (./numeric-definitions.ts), the
 *  fast path of it and its independent reading in tests. */
export const kernels: NumberKernel[] = [
  {
    head: "PrimeNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => nthPrime(r + 1),
    // BPSW reads a bigint exactly; the rank (π) is out of reach past 2^53.
    bigElements: true,
    valid: (element) => (typeof element === "bigint" ? isPrimeBig(element) : isPrime(Number(element))),
    rank: (element) => {
      if (typeof element === "bigint" && element > BigInt(Number.MAX_SAFE_INTEGER))
        throw new RangeError(`PrimeNumbers: element ${element} exceeds 2^53; its kernel is not bigint yet`);
      return primeRank(Number(element));
    },
    declared: numeric("scan"),
  },
  {
    head: "SquareNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => (r + 1) * (r + 1),
    valid: (element) => squareRoot(Number(element)) > 0,
    rank: (element) => squareRoot(Number(element)) - 1,
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

export const entries: (NumberKernel | EpsilFamily)[] = withScanDefinitions(withDefinitions(kernels));
