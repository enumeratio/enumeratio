// Divisor and multiplicative-structure numeric sets: paramCount:0 scalar FamilyKernels
// (see numeric-sets.ts for the pattern this follows) plus the one-parameter selector
// KFreeIntegers(k). collections has no dependency on @enumeratio/residues or
// @enumeratio/number-theory (see its package.json), so the divisor-sum/factoring helpers
// below are a fresh, plain-number implementation local to this file, not an import --
// same reason numeric-sets.ts carries its own isPrime/sumProperDivisors rather than
// importing them. isAbundant/sumProperDivisors below are literally copied from
// numeric-sets.ts's AbundantNumbers helpers to share its predicate style, as asked.
import type { EpsilFamily } from "./epsil.ts";
import { withScanDefinitions } from "./scan-definitions.ts";
import type { Declared, NumberKernel } from "./types.ts";
import { declineWork, factorsOf, isPrimeNumber, matchCache, memoBy, sigmaOf as sigmaBig } from "./work.ts";

// ---- divisor/factoring primitives, plain numbers (safe within Number.MAX_SAFE_INTEGER). ----

const isPrime = isPrimeNumber;

/** Ascending [prime, exponent] pairs of n's factorisation. */
const primeFactorsOf = (n: number): [number, number][] => factorsOf(Math.abs(Math.trunc(n)));

/** All divisors of n, ascending, including 1 and n: built from the factorisation. */
function divisorsOf(n: number): number[] {
  if (!Number.isSafeInteger(n) || n < 1) return [];
  let divs = [1];
  for (const [p, e] of primeFactorsOf(n)) {
    const next: number[] = [];
    for (let k = 0, power = 1; k <= e; k++, power *= p) for (const d of divs) next.push(d * power);
    divs = next;
  }
  return divs.toSorted((a, b) => a - b);
}

const properDivisorsOf = (n: number): number[] => divisorsOf(n).filter((d) => d !== n);
const sigmaOf = (n: number): number => Number(sigmaBig(n));
const numDivisorsOf = (n: number): number => divisorsOf(n).length;

// ---- AbundantNumbers / DeficientNumbers: σ(n) against 2n, σ exact from the factorisation. ----

const isAbundant = (n: number): boolean => Number.isSafeInteger(n) && n >= 1 && sigmaBig(n) > 2n * BigInt(n);
const isDeficient = (n: number): boolean => Number.isSafeInteger(n) && n >= 1 && sigmaBig(n) < 2n * BigInt(n);

// ---- exact-power / factor-shape predicates. ----

const isSquareFree = (n: number): boolean => n >= 1 && primeFactorsOf(n).every(([, e]) => e === 1);
const isKFree = (n: number, k: number): boolean => n >= 1 && primeFactorsOf(n).every(([, e]) => e < k);
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
/** The greatest n whose subset-sum table (n bytes, n steps a divisor) is built: about a second. */
const SEMIPERFECT_LIMIT = 2e6;

function isSemiperfect(n: number): boolean {
  if (n > SEMIPERFECT_LIMIT) return declineWork(`Semiperfect: ${n}`);
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

const isArithmetic = (n: number): boolean =>
  Number.isSafeInteger(n) && n >= 1 && sigmaBig(n) % BigInt(numDivisorsOf(n)) === 0n;

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

/** Listing the divisors of n costs a few microseconds near 10^5 (measured), growing with its square root. */
const divisorsCost = (n: number): number => 150 + 2 * Math.sqrt(n);

function highlyCompositeCache() {
  let maxDivisorCount = 0;
  return matchCache(
    "HighlyCompositeNumbers",
    (n) => {
      const t = numDivisorsOf(n);
      if (t <= maxDivisorCount) return false;
      maxDivisorCount = t;
      return true;
    },
    { cost: divisorsCost },
  );
}
const highlyComposite = highlyCompositeCache();

function superabundantCache() {
  // Best abundancy sigma(n)/n so far, compared by cross-multiplication to stay exact.
  let bestSigma = 0;
  let bestN = 1;
  return matchCache(
    "SuperabundantNumbers",
    (n) => {
      const s = sigmaOf(n);
      if (s * bestN <= bestSigma * n) return false;
      bestSigma = s;
      bestN = n;
      return true;
    },
    { cost: divisorsCost },
  );
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

/** The greatest sieve of aliquot sums built (n² for the n asked): 4 million, about 40 MB while it is built. */
const UNTOUCHED_LIMIT = 2e6;

function isUntouchable(n: number): boolean {
  if (n < 1) return false;
  if (n * n > UNTOUCHED_LIMIT) return declineWork(`Untouchable: ${n}`);
  growTouchedTo(Math.max(256, n * n));
  return touchedSieve?.[n] !== 1;
}

// ---- LuckyNumbers: Ulam's sieve, grown (and fully rebuilt) on demand. ----

/** The greatest limit the sieve is grown to (an array of half as many numbers, filtered once a lucky number). */
const LUCKY_LIMIT = 65_536;

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
    if (limit > LUCKY_LIMIT) return declineWork(`Lucky: term ${k}`);
    growLuckyTo(limit);
  }
  return luckyTerms[k - 1];
}

function luckyRankOf(value: number): number {
  if (!Number.isInteger(value) || value < 1) return -1;
  if (value > LUCKY_LIMIT) return declineWork(`Lucky: ${value}`);
  let limit = Math.max(luckyLimit, value);
  growLuckyTo(limit);
  while (luckyTerms[luckyTerms.length - 1] < value) {
    limit *= 2;
    growLuckyTo(limit);
  }
  return luckyTerms.indexOf(value);
}

// ---- SmoothNumbers(k)-style per-parameter cache, for KFreeIntegers(k). ----

const kFreeCaches = new Map<number, ReturnType<typeof matchCache>>();
function kFreeCacheFor(k: number): ReturnType<typeof matchCache> {
  return memoBy(kFreeCaches, k, () => matchCache("KFreeIntegers", (n) => isKFree(n, k)));
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
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 18, 21, 22, 24, 25, 28, 30, 33, 37, 40, 42, 45, 48, 57, 58, 60, 70, 72,
  78, 85, 88, 93, 102, 105, 112, 120, 130, 133, 165, 168, 177, 190, 210, 232, 240, 253, 273, 280, 312, 330, 345, 357,
  385, 408, 462, 520, 760, 840, 1320, 1365, 1848,
];

/** A paramCount:0 scalar family known only as far as its table: an open problem (count NaN)
 *  whose known terms end with the table. */
function tableEntry(table: readonly number[]): Pick<NumberKernel, "unrank" | "valid" | "rank" | "declared"> {
  return {
    declared: {
      carrier: "Numeric",
      params: [],
      cost: { count: "closed", unrank: "closed", rank: "closed", valid: "closed" },
      known: () => BigInt(table.length),
    } satisfies Declared,
    unrank: (_p, r) => (r < table.length ? table[r] : Number.NaN),
    valid: (element) => table.includes(Number(element)),
    rank: (element) => table.indexOf(Number(element)),
  };
}

/** What the subset-sum table of `isSemiperfect` costs, in the steps of a double loop. */
const semiperfectCost = (n: number): number => (n * Math.log(n + 2)) / 2.5;

/** A paramCount:0 scalar family driven by a plain predicate, via one shared nthMatchCache. */
function predicateEntry(
  head: string,
  predicate: (n: number) => boolean,
  cost?: (n: number) => number,
): Pick<NumberKernel, "unrank" | "valid" | "rank"> {
  const cache = matchCache(head, predicate, cost === undefined ? {} : { cost });
  return {
    unrank: (_p, r) => cache.nth(r + 1),
    valid: (element) => predicate(Number(element)),
    rank: (element) => cache.rankOf(Number(element)),
  };
}

/** Same shape, for a family whose membership can only be answered by rank (record-setting
 *  scans like HighlyCompositeNumbers, where "valid" has no cheaper test than "is it a
 *  record" -- which the cache already computes when asked for the rank). */
function cacheEntry(cache: ReturnType<typeof matchCache>): Pick<NumberKernel, "unrank" | "valid" | "rank"> {
  return {
    unrank: (_p, r) => cache.nth(r + 1),
    valid: (element) => cache.rankOf(Number(element)) >= 0,
    rank: (element) => cache.rankOf(Number(element)),
  };
}

export const kernels: NumberKernel[] = [
  {
    head: "DeficientNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry("DeficientNumbers", isDeficient),
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
    ...predicateEntry("SemiperfectNumbers", isSemiperfect, semiperfectCost),
  },
  {
    head: "WeirdNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry("WeirdNumbers", isWeird, semiperfectCost),
  },
  {
    head: "PracticalNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry("PracticalNumbers", isPractical, () => 300),
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
    ...predicateEntry("ArithmeticNumbers", isArithmetic, () => 300),
  },
  {
    head: "UntouchableNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry("UntouchableNumbers", isUntouchable, (n) => n * n),
  },
  {
    head: "AchillesNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry("AchillesNumbers", isAchilles),
  },
  {
    head: "PowerfulNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry("PowerfulNumbers", isPowerful),
  },
  {
    head: "PerfectPowerNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry("PerfectPowerNumbers", isPerfectPower, (n) => 200 + 0.6 * Math.sqrt(n)),
  },
  {
    head: "SquareFreeNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry("SquareFreeNumbers", isSquareFree),
  },
  {
    declared: {
      carrier: "Numeric",
      params: [{ name: "k", role: "param", min: 0 }],
      cost: { count: "closed", unrank: "scan", rank: "scan", valid: "polynomial" },
    },
    head: "KFreeIntegers",
    paramCount: 1,
    kind: "scalar",
    // Below k = 2 every prime power is excluded, leaving {1}: finite, and a scan for its
    // second element would never end.
    count: ([k]) => (k < 2 ? 1 : Number.POSITIVE_INFINITY),
    unrank: ([k], r) => (k < 2 ? (r === 0 ? 1 : Number.NaN) : kFreeCacheFor(k).nth(r + 1)),
    valid: (element, [k]) => isKFree(Number(element), k),
    rank: (element, [k]) => kFreeCacheFor(k).rankOf(Number(element)),
  },
  {
    head: "CarmichaelNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    ...predicateEntry("CarmichaelNumbers", isCarmichael),
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

/** Where a family has an Epsil definition (./scan-definitions.ts), that with the kernel as its fast path. */
export const entries: (NumberKernel | EpsilFamily)[] = withScanDefinitions(kernels);
