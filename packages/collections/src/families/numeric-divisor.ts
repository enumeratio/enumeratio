// Divisor and multiplicative-structure numeric sets: paramCount:0 scalar FamilyKernels
// (see numeric-sets.ts for the pattern this follows) plus the one-parameter selector
// KFreeIntegers(k). collections has no dependency on @enumeratio/residues or
// @enumeratio/number-theory (see its package.json), so the divisor-sum/factoring helpers
// below are a fresh, plain-number implementation local to this file, not an import --
// same reason numeric-sets.ts carries its own isPrime/sumProperDivisors rather than
// importing them. isAbundant/sumProperDivisors below are literally copied from
// numeric-sets.ts's AbundantNumbers helpers to share its predicate style, as asked.
import type { FamilyKernel } from "./types.ts";

// ---- shared: memoised "nth n with predicate(n)" scan (copied from numeric-sets.ts). ----

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
    nth: (k: number): number => {
      extendTo(k);
      return matches[k - 1];
    },
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

// ---- divisor/factoring primitives, plain numbers (safe within Number.MAX_SAFE_INTEGER). ----

function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
  return true;
}

/** Ascending [prime, exponent] pairs of n's factorisation by trial division. */
function primeFactorsOf(n: number): [number, number][] {
  let m = Math.abs(Math.trunc(n));
  const factors: [number, number][] = [];
  for (let p = 2; p * p <= m; p++) {
    if (m % p !== 0) continue;
    let exp = 0;
    while (m % p === 0) {
      m /= p;
      exp++;
    }
    factors.push([p, exp]);
  }
  if (m > 1) factors.push([m, 1]);
  return factors;
}

/** All divisors of n, ascending, including 1 and n. */
function divisorsOf(n: number): number[] {
  if (n < 1) return [];
  const divs: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d !== 0) continue;
    divs.push(d);
    const cofactor = n / d;
    if (cofactor !== d) divs.push(cofactor);
  }
  divs.sort((a, b) => a - b);
  return divs;
}

const properDivisorsOf = (n: number): number[] => divisorsOf(n).filter((d) => d !== n);
const sigmaOf = (n: number): number => divisorsOf(n).reduce((s, d) => s + d, 0);
const numDivisorsOf = (n: number): number => divisorsOf(n).length;

// ---- AbundantNumbers helper, copied verbatim from numeric-sets.ts's own copy. ----

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

// ---- exact-power / factor-shape predicates. ----

const isSquareFree = (n: number): boolean => n >= 1 && primeFactorsOf(n).every(([, e]) => e === 1);
const isKFree = (n: number, k: number): boolean =>
  n >= 1 && primeFactorsOf(n).every(([, e]) => e < k);
const isPowerful = (n: number): boolean => n >= 1 && primeFactorsOf(n).every(([, e]) => e >= 2);

function ipow(a: number, k: number): number {
  let r = 1;
  for (let i = 0; i < k; i++) r *= a;
  return r;
}

/** n = a^k for integers a >= 2, k >= 2 (matches the catalog's PerfectPowerNumbers wording,
 *  which excludes the vacuous a = 1 / n = 1 case that some OEIS variants include). */
function isPerfectPower(n: number): boolean {
  if (n < 4) return false;
  for (let k = 2; ipow(2, k) <= n; k++) {
    let lo = 2;
    let hi = n;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const val = ipow(mid, k);
      if (val === n) return true;
      if (val < n) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return false;
}

// n = 1 is vacuously powerful and (classically, with a = 1 allowed) a perfect power, so it's
// excluded here explicitly -- our PerfectPowerNumbers requires a >= 2 and wouldn't catch it.
const isAchilles = (n: number): boolean => n > 1 && isPowerful(n) && !isPerfectPower(n);

// ---- subset-sum-of-divisors predicates (semiperfect / weird / practical). ----

/** Does some subset of n's proper divisors sum to exactly n? 0/1 DP over reachable sums,
 *  bounded by n -- fine at the scale this family is queried at (small n; see the test file
 *  for the deliberately small term counts this costs). */
function isSemiperfect(n: number): boolean {
  const divs = properDivisorsOf(n);
  if (divs.length === 0) return false;
  const reachable = new Uint8Array(n + 1);
  reachable[0] = 1;
  for (const d of divs) {
    for (let s = n; s >= d; s--) {
      if (reachable[s - d]) reachable[s] = 1;
    }
  }
  return reachable[n] === 1;
}

const isWeird = (n: number): boolean => isAbundant(n) && !isSemiperfect(n);

/** Every m <= n is a sum of distinct divisors of n, checked via the classical criterion:
 *  sorted divisors d1=1 < d2 < ... < dk=n, practical iff no d_{i+1} exceeds 1 + running sum
 *  of d1..di. */
function isPractical(n: number): boolean {
  if (n < 1) return false;
  let sum = 0;
  for (const d of divisorsOf(n)) {
    if (d > sum + 1) return false;
    sum += d;
  }
  return true;
}

const isArithmetic = (n: number): boolean => n >= 1 && sigmaOf(n) % numDivisorsOf(n) === 0;

/** Korselt's criterion: composite, squarefree, and (p-1) | (n-1) for every prime p | n --
 *  equivalent to "Fermat pseudoprime to every base coprime to n." */
function isCarmichael(n: number): boolean {
  if (n <= 1 || isPrime(n)) return false;
  const factors = primeFactorsOf(n);
  if (factors.length < 2 || factors.some(([, e]) => e > 1)) return false;
  return factors.every(([p]) => (n - 1) % (p - 1) === 0);
}

// ---- HighlyCompositeNumbers / SuperabundantNumbers: record-setting scans. nthMatchCache
// calls its predicate on every integer exactly once, in increasing order, so a predicate
// closing over "best so far" is safe -- each n is only ever classified once. ----

function highlyCompositeCache() {
  let maxDivisorCount = 0;
  return nthMatchCache((n) => {
    const t = numDivisorsOf(n);
    if (t <= maxDivisorCount) return false;
    maxDivisorCount = t;
    return true;
  });
}
const highlyComposite = highlyCompositeCache();

function superabundantCache() {
  // Best abundancy sigma(n)/n so far, compared by cross-multiplication to stay exact.
  let bestSigma = 0;
  let bestN = 1;
  return nthMatchCache((n) => {
    const s = sigmaOf(n);
    if (s * bestN <= bestSigma * n) return false;
    bestSigma = s;
    bestN = n;
    return true;
  });
}
const superabundant = superabundantCache();

// ---- UntouchableNumbers: n never equal to sigma(m) - m (aliquot sum) for any m. A sieve
// of aliquot sums up to a bound, doubled on demand like numeric-sets.ts's prime sieve.
// The bound has to be at least ~n^2: m = p^2 for prime p = n-1 gives aliquot sum 1+p = n,
// and p can be as large as n-1, so m can be as large as (n-1)^2. n*n is a safe margin. ----

let touchedSieve: Uint8Array | undefined;
let touchedLimit = 0;

function growTouchedTo(minLimit: number): void {
  if (touchedLimit >= minLimit) return;
  const limit = Math.max(minLimit, touchedLimit * 2, 256);
  const sigma = new Float64Array(limit + 1);
  for (let d = 1; d <= limit; d++) {
    for (let m = d; m <= limit; m += d) sigma[m] += d;
  }
  const touched = new Uint8Array(limit + 1);
  for (let m = 2; m <= limit; m++) {
    const s = sigma[m] - m;
    if (s >= 1 && s <= limit) touched[s] = 1;
  }
  touchedSieve = touched;
  touchedLimit = limit;
}

function isUntouchable(n: number): boolean {
  if (n < 1) return false;
  growTouchedTo(Math.max(256, n * n));
  return touchedSieve?.[n] !== 1;
}

// ---- LuckyNumbers: Ulam's sieve, grown (and fully rebuilt) on demand. ----

let luckyTerms: number[] = [1, 3];
let luckyLimit = 3;

function growLuckyTo(limit: number): void {
  if (limit <= luckyLimit) return;
  let remaining: number[] = [];
  for (let i = 1; i <= limit; i += 2) remaining.push(i);
  let i = 1; // remaining[1] === 3, the first sieving step past the trivial "keep odds" pass
  while (i < remaining.length) {
    const step = remaining[i];
    const next: number[] = [];
    for (let idx = 0; idx < remaining.length; idx++) {
      if ((idx + 1) % step !== 0) next.push(remaining[idx]);
    }
    remaining = next;
    i++;
  }
  luckyTerms = remaining;
  luckyLimit = limit;
}

/** The k-th lucky number (1-indexed), growing the sieve until it has produced enough terms. */
function luckyNth(k: number): number {
  let limit = luckyLimit;
  while (luckyTerms.length < k) {
    limit *= 2;
    growLuckyTo(limit);
  }
  return luckyTerms[k - 1];
}

function luckyRankOf(value: number): number {
  if (!Number.isInteger(value) || value < 1) return -1;
  let limit = Math.max(luckyLimit, value);
  growLuckyTo(limit);
  while (luckyTerms[luckyTerms.length - 1] < value) {
    limit *= 2;
    growLuckyTo(limit);
  }
  return luckyTerms.indexOf(value);
}

// ---- SmoothNumbers(k)-style per-parameter cache, for KFreeIntegers(k). ----

const kFreeCaches = new Map<number, ReturnType<typeof nthMatchCache>>();
function kFreeCacheFor(k: number): ReturnType<typeof nthMatchCache> {
  let cache = kFreeCaches.get(k);
  if (!cache) {
    cache = nthMatchCache((n) => isKFree(n, k));
    kFreeCaches.set(k, cache);
  }
  return cache;
}

// ---- known-term tables for the three sets whose infinitude is an open problem. Past the
// table, unrank returns NaN (boxed as the symbol NaN) rather than scanning forever --
// there is no predicate here that could safely keep searching. ----

// A000396, Euclid-Euler even perfect numbers 2^(p-1)(2^p-1) for Mersenne-prime exponents
// p = 2, 3, 5, 7, 13, 17, 19 -- the 8th (p = 31) is ~2.3e18, past Number.MAX_SAFE_INTEGER.
const PERFECT_NUMBERS = [6, 28, 496, 8128, 33550336, 8589869056, 137438691328];

// A007850. Only the first four Giuga numbers are included here with confidence; OEIS lists
// further known (larger) terms, omitted rather than risked on an unverified constant.
const GIUGA_NUMBERS = [30, 858, 1722, 66198];

// A000926, Euler's 65 numeri idonei -- exhaustive assuming GRH, otherwise at most one more
// (necessarily > 1848) could exist.
const IDONEAL_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 18, 21, 22, 24, 25, 28, 30, 33, 37, 40, 42, 45, 48,
  57, 58, 60, 70, 72, 78, 85, 88, 93, 102, 105, 112, 120, 130, 133, 165, 168, 177, 190, 210, 232,
  240, 253, 273, 280, 312, 330, 345, 357, 385, 408, 462, 520, 760, 840, 1320, 1365, 1848,
];

function tableEntry(table: readonly number[]): Pick<FamilyKernel, "unrank" | "valid" | "rank"> {
  return {
    unrank: (_p, r) => (r < table.length ? table[r] : Number.NaN),
    valid: (element) => table.includes(Number(element)),
    rank: (element) => table.indexOf(Number(element)),
  };
}

/** A paramCount:0 scalar family driven by a plain predicate, via one shared nthMatchCache. */
function predicateEntry(
  predicate: (n: number) => boolean,
): Pick<FamilyKernel, "unrank" | "valid" | "rank"> {
  const cache = nthMatchCache(predicate);
  return {
    unrank: (_p, r) => cache.nth(r + 1),
    valid: (element) => predicate(Number(element)),
    rank: (element) => cache.rankOf(Number(element)),
  };
}

/** Same shape, for a family whose membership can only be answered by rank (record-setting
 *  scans like HighlyCompositeNumbers, where "valid" has no cheaper test than "is it a
 *  record" -- which the cache already computes when asked for the rank). */
function cacheEntry(
  cache: ReturnType<typeof nthMatchCache>,
): Pick<FamilyKernel, "unrank" | "valid" | "rank"> {
  return {
    unrank: (_p, r) => cache.nth(r + 1),
    valid: (element) => cache.rankOf(Number(element)) >= 0,
    rank: (element) => cache.rankOf(Number(element)),
  };
}

export const entries: FamilyKernel[] = [
  {
    head: "DeficientNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry((n) => sumProperDivisors(n) < n),
  },
  {
    head: "PerfectNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    ...tableEntry(PERFECT_NUMBERS),
  },
  {
    head: "SemiperfectNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry(isSemiperfect),
  },
  {
    head: "WeirdNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry(isWeird),
  },
  {
    head: "PracticalNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry(isPractical),
  },
  {
    head: "HighlyCompositeNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...cacheEntry(highlyComposite),
  },
  {
    head: "SuperabundantNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...cacheEntry(superabundant),
  },
  {
    head: "ArithmeticNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry(isArithmetic),
  },
  {
    head: "UntouchableNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry(isUntouchable),
  },
  {
    head: "AchillesNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry(isAchilles),
  },
  {
    head: "PowerfulNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry(isPowerful),
  },
  {
    head: "PerfectPowerNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry(isPerfectPower),
  },
  {
    head: "SquareFreeNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry(isSquareFree),
  },
  {
    head: "KFreeIntegers",
    paramCount: 1,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: ([k], r) => kFreeCacheFor(k).nth(r + 1),
    valid: (element, [k]) => isKFree(Number(element), k),
    rank: (element, [k]) => kFreeCacheFor(k).rankOf(Number(element)),
  },
  {
    head: "CarmichaelNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry(isCarmichael),
  },
  {
    head: "GiugaNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    ...tableEntry(GIUGA_NUMBERS),
  },
  {
    head: "IdonealNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    ...tableEntry(IDONEAL_NUMBERS),
  },
  {
    head: "LuckyNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => luckyNth(r + 1),
    valid: (element) => luckyRankOf(Number(element)) >= 0,
    rank: (element) => luckyRankOf(Number(element)),
  },
];
