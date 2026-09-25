// Digit-structure, bit-structure and prime-structure numeric sets/sequences, extending the
// numeric-sets.ts spike (kind:"scalar", paramCount 0 or 1) with a second batch: Harshad,
// Happy, Narcissistic, Automorphic, Kaprekar, Evil/Odious/Pernicious, Smith numbers; the
// prime-structure families (twin/cousin/sexy/Sophie Germain/safe/Mersenne/Fibonacci/
// palindromic/circular/emirp primes, semiprimes and their squarefree/sphenic/prime-power
// kin); and the selectors KAlmostPrimes(k), RoughNumbers(k), PrimePairs(gap).
//
// The sieve/isPrime/nthMatchCache trio below is COPIED from numeric-sets.ts rather than
// imported -- that file isn't meant to export its internals across the family boundary
// (each family file owns its own kernel), so this is a deliberate, reported duplication.
import type { NumberKernel } from "./types.ts";

// ---- copied from numeric-sets.ts: incremental sieve + trial-division primality. ----

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

function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n <= sieveLimit) return sievePrimes.includes(n);
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

/** The prime factorisation of `n` (n >= 2) as ascending [prime, exponent] pairs, by trial
 *  division against the sieve. Grows the sieve to sqrt(n) first so no prime is skipped. */
function factorize(n: number): [number, number][] {
  let m = n;
  growSieveTo(Math.ceil(Math.sqrt(m)) + 1);
  const factors: [number, number][] = [];
  for (const p of sievePrimes) {
    if (p * p > m) break;
    if (m % p !== 0) continue;
    let e = 0;
    while (m % p === 0) {
      m /= p;
      e++;
    }
    factors.push([p, e]);
  }
  if (m > 1) factors.push([m, 1]);
  return factors;
}

/** Omega(n): count of prime factors of n, with multiplicity. Omega(1) = 0. */
const omega = (n: number): number => (n < 2 ? 0 : factorize(n).reduce((s, [, e]) => s + e, 0));

// ---- copied from numeric-sets.ts, generalised with a `start` so Evil (which includes 0)
// can share it with the rest (which start their scan at 1). ----

function nthMatchCacheFrom(start: number, predicate: (n: number) => boolean) {
  const matches: number[] = [];
  let scanned = start - 1;
  const extendTo = (count: number): void => {
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
      if (!Number.isInteger(value) || value < start) return -1;
      while (scanned < value) {
        scanned++;
        if (predicate(scanned)) matches.push(scanned);
      }
      return matches.indexOf(value);
    },
  };
}
const nthMatchCache = (predicate: (n: number) => boolean) => nthMatchCacheFrom(1, predicate);

// ---- digit helpers (base 10). ----

const digitsOf = (n: number): number[] => String(n).split("").map(Number);
const digitSum = (n: number): number => digitsOf(n).reduce((s, d) => s + d, 0);

// ---- HarshadNumbers: A005349. n divisible by its own digit sum. ----

const isHarshad = (n: number): boolean => n >= 1 && n % digitSum(n) === 0;
const harshadCache = nthMatchCache(isHarshad);

// ---- HappyNumbers: A007770. Iterating sum-of-squared-digits reaches 1 (vs. the one other
// cycle, {4,16,37,58,89,145,42,20,4,...}). ----

function isHappy(n: number): boolean {
  const seen = new Set<number>();
  let x = n;
  while (x !== 1 && !seen.has(x)) {
    seen.add(x);
    x = digitsOf(x).reduce((s, d) => s + d * d, 0);
  }
  return x === 1;
}
const happyCache = nthMatchCache(isHappy);

// ---- NarcissisticNumbers (Armstrong numbers): A005188, excluding the trivial 0 -- PROVEN
// finite, exactly 88 terms (the largest is the 39-digit 115132219018763992565095597973971522401,
// per Diamond & Kellner's 1993 base-b bound d(10) = 60). The first 43 fit in a plain `number`;
// the remaining 45 exceed Number.MAX_SAFE_INTEGER (2^53 - 1) and are carried as exact `bigint`
// (the `narrow()` idiom from numeric-closed-form.ts, inlined here rather than imported -- see
// this file's own note at the top about families not sharing kernels across the boundary).
// `unrank` used to answer NaN past the safe prefix -- a known value, just not one `number` can
// carry, and worse, a value that collapses every large pair to the same NaN under Plausible's
// JSON.stringify-based comparison (issue #90). Returning the bigint instead keeps every rank
// exact and distinct. `valid` needs no table at all -- it checks the definition directly via
// BigInt digit-power sums, exact for any representable input. Values from OEIS A005188
// (b-file), indices 2-89 (index 1 is the excluded 0), verified against the definition in
// numeric-digits-primes.test.ts. ----

const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);

/** bigint -> plain number when exact there, else the bigint itself (still an exact integer,
 *  just not representable as an IEEE double without loss). Cast at the call site, since
 *  `NumberKernel`'s scalar element type is `number`. Same idiom as numeric-closed-form.ts. */
function narrow(x: bigint): number {
  return x <= MAX_SAFE_BIG ? Number(x) : (x as unknown as number);
}

const NARCISSISTIC_NUMBERS: readonly bigint[] = [
  1n,
  2n,
  3n,
  4n,
  5n,
  6n,
  7n,
  8n,
  9n,
  153n,
  370n,
  371n,
  407n,
  1634n,
  8208n,
  9474n,
  54748n,
  92727n,
  93084n,
  548834n,
  1741725n,
  4210818n,
  9800817n,
  9926315n,
  24678050n,
  24678051n,
  88593477n,
  146511208n,
  472335975n,
  534494836n,
  912985153n,
  4679307774n,
  32164049650n,
  32164049651n,
  40028394225n,
  42678290603n,
  44708635679n,
  49388550606n,
  82693916578n,
  94204591914n,
  28116440335967n,
  4338281769391370n,
  4338281769391371n,
  21897142587612075n,
  35641594208964132n,
  35875699062250035n,
  1517841543307505039n,
  3289582984443187032n,
  4498128791164624869n,
  4929273885928088826n,
  63105425988599693916n,
  128468643043731391252n,
  449177399146038697307n,
  21887696841122916288858n,
  27879694893054074471405n,
  27907865009977052567814n,
  28361281321319229463398n,
  35452590104031691935943n,
  174088005938065293023722n,
  188451485447897896036875n,
  239313664430041569350093n,
  1550475334214501539088894n,
  1553242162893771850669378n,
  3706907995955475988644380n,
  3706907995955475988644381n,
  4422095118095899619457938n,
  121204998563613372405438066n,
  121270696006801314328439376n,
  128851796696487777842012787n,
  174650464499531377631639254n,
  177265453171792792366489765n,
  14607640612971980372614873089n,
  19008174136254279995012734740n,
  19008174136254279995012734741n,
  23866716435523975980390369295n,
  1145037275765491025924292050346n,
  1927890457142960697580636236639n,
  2309092682616190307509695338915n,
  17333509997782249308725103962772n,
  186709961001538790100634132976990n,
  186709961001538790100634132976991n,
  1122763285329372541592822900204593n,
  12639369517103790328947807201478392n,
  12679937780272278566303885594196922n,
  1219167219625434121569735803609966019n,
  12815792078366059955099770545296129367n,
  115132219018763992565095597973971522400n,
  115132219018763992565095597973971522401n,
];
const NARCISSISTIC_COUNT = 88;

/** Checks the definition directly (sum of digit^digitCount == n) via exact BigInt arithmetic,
 *  so it stays correct at any magnitude a `bigint` element can represent -- no dependence on
 *  the NARCISSISTIC_NUMBERS table. */
function isNarcissisticBig(n: bigint): boolean {
  if (n < 1n) return false;
  const digits = n.toString().split("");
  const d = BigInt(digits.length);
  const sum = digits.reduce((s, ch) => s + BigInt(ch) ** d, 0n);
  return sum === n;
}

/** Loosely read an element (number or bigint, whatever the caller has) as a bigint,
 *  or `undefined` if it isn't an integer at all. */
function toBigNarcissistic(x: unknown): bigint | undefined {
  if (typeof x === "bigint") return x;
  if (typeof x === "number" && Number.isInteger(x)) return BigInt(x);
  return undefined;
}

// ---- AutomorphicNumbers: A003226 (excluding the trivial 0). n whose square ends in n (base
// 10). Genuinely infinite -- but so sparse (about 2 per digit length) that a sequential
// nthMatchCache scan for it alone, unlike every other family above, never reaches double-digit
// ranks: the gap between consecutive terms roughly 10x's each time, so it stalls scanning
// integer-by-integer through a range no computer finishes. Instead this generates the two
// idempotent chains mod 10^k directly by Hensel lifting (x_(k+1) = x_k + d*10^k, the unique
// d in 0..9 with (x_(k+1))^2 = x_(k+1) mod 10^(k+1)) -- exact, and O(1) bigint work per digit
// added, the same "construct forward, don't search" move Primes' sieve makes for primality.
// `valid` still checks the endsWith definition directly, so it stays correct at any magnitude
// the input can represent; only `unrank`/`rank` depend on the generated table, capped like
// Mersenne/Fibonacci at Number.MAX_SAFE_INTEGER since a scalar element can't carry more. ----

function isAutomorphic(n: number): boolean {
  if (n < 1) return false;
  const sq = (BigInt(n) * BigInt(n)).toString();
  return sq.endsWith(String(n));
}

/** Hensel-lift x (idempotent mod 10^k) to the unique x' = x + d*10^k, idempotent mod
 *  10^(k+1); d = 0 means the chain grew no new leading digit at this length. */
function liftIdempotent(x: bigint, k: number): bigint {
  const modK = 10n ** BigInt(k);
  const c = ((x * x - x) / modK) % 10n; // x^2 - x is exactly divisible by 10^k here
  const coeff = (2n * x - 1n) % 10n;
  for (let d = 0n; d < 10n; d++) {
    if ((((c + d * coeff) % 10n) + 10n) % 10n === 0n) return x + d * modK;
  }
  throw new Error("no Hensel lift found (unreachable: 2x-1 is always a unit mod 10 here)");
}

let automorphicNumbersCache: number[] | undefined;
function automorphicNumbersTable(): number[] {
  if (!automorphicNumbersCache) {
    const table: number[] = [];
    const limit = BigInt(Number.MAX_SAFE_INTEGER);
    let branches: [bigint, bigint] = [5n, 6n]; // the two nontrivial idempotents mod 10
    table.push(1, 5, 6); // 1 is the trivial idempotent (1^2 = 1); it never grows a new digit
    for (let k = 1; branches[0] <= limit || branches[1] <= limit; k++) {
      const next: [bigint, bigint] = [liftIdempotent(branches[0], k), liftIdempotent(branches[1], k)];
      for (let i = 0; i < 2; i++) {
        if (next[i] !== branches[i] && next[i] <= limit) table.push(Number(next[i]));
      }
      branches = next;
    }
    automorphicNumbersCache = table.sort((a, b) => a - b);
  }
  return automorphicNumbersCache;
}

// ---- KaprekarNumbers: A006886. n whose square splits SOMEWHERE into a left and a (nonzero)
// right part that sum back to n (e.g. 45^2 = 2025 -> 20 + 25 = 45; 4879^2 = 23804641 ->
// 238 + 4641 = 4879, a split that does NOT sit at n's own digit count -- a carry can move it,
// so every split position has to be tried). Infinite: every repunit-of-9s 10^k - 1 is
// Kaprekar, since (10^k-1)^2 = 10^2k - 2*10^k + 1 splits at position k into (10^k - 2) and
// (10^k - 1's last k digits), summing to 10^k - 1. ----

function isKaprekar(n: number): boolean {
  if (n < 1) return false;
  const sq = (BigInt(n) * BigInt(n)).toString();
  for (let i = 0; i < sq.length; i++) {
    const left = sq.slice(0, i);
    const right = sq.slice(i);
    const rightVal = Number(right);
    if (rightVal === 0) continue;
    const leftVal = left === "" ? 0 : Number(left);
    if (leftVal + rightVal === n) return true;
  }
  return false;
}
const kaprekarCache = nthMatchCache(isKaprekar);

// ---- Evil/Odious/Pernicious: A001969 / A000069 / A052294, by binary weight (popcount).
// Evil starts at 0 (popcount 0, even), the one family here whose first term isn't >= 1. ----

const popcount = (n: number): number =>
  n
    .toString(2)
    .split("")
    .filter((c) => c === "1").length;
const isEvil = (n: number): boolean => n >= 0 && popcount(n) % 2 === 0;
const isOdious = (n: number): boolean => n >= 0 && popcount(n) % 2 === 1;
const isPernicious = (n: number): boolean => n >= 0 && isPrime(popcount(n));
const evilCache = nthMatchCacheFrom(0, isEvil);
const odiousCache = nthMatchCache(isOdious);
const perniciousCache = nthMatchCache(isPernicious);

// ---- SmithNumbers: A006753. Composite n whose digit sum equals the digit sum of its prime
// factors, counted with multiplicity. Infinite (McDaniel 1987). ----

function isSmith(n: number): boolean {
  if (n < 4 || isPrime(n)) return false;
  const factorDigitSum = factorize(n).reduce((s, [p, e]) => s + e * digitSum(p), 0);
  return factorDigitSum === digitSum(n);
}
const smithCache = nthMatchCache(isSmith);

// ---- Semiprimes / squarefree semiprimes / sphenic / prime powers: by Omega(n) and the
// factorisation shape. All infinite (each has an obvious one-parameter infinite subfamily,
// e.g. 2p for varying primes p). ----

const isSemiprime = (n: number): boolean => omega(n) === 2;
const isSquarefreeSemiprime = (n: number): boolean => {
  const f = factorize(n);
  return f.length === 2 && f.every(([, e]) => e === 1);
};
const isSphenic = (n: number): boolean => {
  const f = factorize(n);
  return f.length === 3 && f.every(([, e]) => e === 1);
};
const isPrimePower = (n: number): boolean => n >= 2 && factorize(n).length === 1;
const semiprimeCache = nthMatchCache(isSemiprime);
const squarefreeSemiprimeCache = nthMatchCache(isSquarefreeSemiprime);
const sphenicCache = nthMatchCache(isSphenic);
const primePowerCache = nthMatchCache(isPrimePower);

// ---- KAlmostPrimes(k): Omega(n) = k, a one-parameter selector. k=1 is Primes verbatim,
// k=2 is SemiprimeNumbers verbatim (both cross-checked in the test file). Infinite for every
// k >= 1: 2^(k-1) * p has Omega = k for every prime p. ----

const kAlmostCaches = new Map<number, ReturnType<typeof nthMatchCache>>();
function kAlmostCacheFor(k: number): ReturnType<typeof nthMatchCache> {
  let cache = kAlmostCaches.get(k);
  if (!cache) {
    cache = nthMatchCache((n) => omega(n) === k);
    kAlmostCaches.set(k, cache);
  }
  return cache;
}

// ---- RoughNumbers(k): every prime factor of n is >= k (1 counts, vacuously -- the
// SmoothNumbers(k) mirror image). Infinite for every k: every sufficiently large prime is
// k-rough. ----

function isRough(n: number, k: number): boolean {
  if (n < 1) return false;
  if (n === 1) return true;
  return factorize(n).every(([p]) => p >= k);
}
const roughCaches = new Map<number, ReturnType<typeof nthMatchCache>>();
function roughCacheFor(k: number): ReturnType<typeof nthMatchCache> {
  let cache = roughCaches.get(k);
  if (!cache) {
    cache = nthMatchCache((n) => isRough(n, k));
    roughCaches.set(k, cache);
  }
  return cache;
}

// ---- prime-pair families: lesser member p of a pair (p, p+gap), both prime -- the catalog's
// reading (A001359/A023200/A023201's "lesser of" convention, not A001097's "both members").
// Infinitude is open for every one of these (the twin-prime conjecture and its kin), so Count
// is NaN throughout, per PrimePairs(gap) for every gap. ----

const isTwinPrime = (n: number): boolean => isPrime(n) && isPrime(n + 2);
const isCousinPrime = (n: number): boolean => isPrime(n) && isPrime(n + 4);
const isSexyPrime = (n: number): boolean => isPrime(n) && isPrime(n + 6);
const isSophieGermainPrime = (n: number): boolean => isPrime(n) && isPrime(2 * n + 1);
const isSafePrime = (n: number): boolean => isPrime(n) && (n - 1) % 2 === 0 && isPrime((n - 1) / 2);
const twinPrimeCache = nthMatchCache(isTwinPrime);
const cousinPrimeCache = nthMatchCache(isCousinPrime);
const sexyPrimeCache = nthMatchCache(isSexyPrime);
const sophieGermainCache = nthMatchCache(isSophieGermainPrime);
const safePrimeCache = nthMatchCache(isSafePrime);

const primePairCaches = new Map<number, ReturnType<typeof nthMatchCache>>();
/** The lesser primes p with p + gap prime, for an odd gap: p = 2 or p + gap = 2. */
const oddGapPairs = (gap: number): number[] =>
  [...new Set([2, 2 - gap])].filter((p) => isPrime(p) && isPrime(p + gap)).sort((a, b) => a - b);

function primePairCacheFor(gap: number): ReturnType<typeof nthMatchCache> {
  let cache = primePairCaches.get(gap);
  if (!cache) {
    cache = nthMatchCache((n) => isPrime(n) && isPrime(n + gap));
    primePairCaches.set(gap, cache);
  }
  return cache;
}

// ---- palindromic / circular / emirp primes: also open infinitude (Count NaN). ----

const isPalindromeNum = (n: number): boolean => {
  const s = String(n);
  return s === s.split("").reverse().join("");
};
const reverseNum = (n: number): number => Number(String(n).split("").reverse().join(""));

const isPalindromicPrime = (n: number): boolean => isPrime(n) && isPalindromeNum(n);
const palindromicPrimeCache = nthMatchCache(isPalindromicPrime);

function isCircularPrime(n: number): boolean {
  if (!isPrime(n)) return false;
  const s = String(n);
  if (s.includes("0")) return false; // a 0 digit rotates to a leading zero -- excluded by convention
  for (let i = 0; i < s.length; i++) {
    const rotated = Number(s.slice(i) + s.slice(0, i));
    if (!isPrime(rotated)) return false;
  }
  return true;
}
const circularPrimeCache = nthMatchCache(isCircularPrime);

function isEmirp(n: number): boolean {
  if (!isPrime(n)) return false;
  const r = reverseNum(n);
  return r !== n && isPrime(r);
}
const emirpCache = nthMatchCache(isEmirp);

// ---- MersennePrimes: A000668, 2^p - 1 for prime p. FibonacciPrimes: A005478, Fibonacci
// numbers that are prime. Both have only a handful of known terms and the known terms grow
// far past Number.MAX_SAFE_INTEGER (the largest known Mersenne prime has tens of millions of
// digits), so unlike every other family here, `unrank` cannot scan-and-grow a cache: it uses a
// table, verified by exact bigint arithmetic (Lucas-Lehmer for Mersenne, primality of the
// Fibonacci value itself) up to the point the VALUE stops fitting in a safe integer, and
// answers NaN past that point -- a documented representable-range limit, not a search that
// might hang. ----

/** Deterministic Miller-Rabin, valid for every n < 3.3 * 10^24 with these witnesses. */
function isPrimeBig(n: bigint): boolean {
  if (n < 2n) return false;
  const smallPrimes = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
  for (const p of smallPrimes) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let r = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    r++;
  }
  const powMod = (base: bigint, exp: bigint, mod: bigint): bigint => {
    let result = 1n;
    let b = base % mod;
    let e = exp;
    while (e > 0n) {
      if (e & 1n) result = (result * b) % mod;
      e >>= 1n;
      b = (b * b) % mod;
    }
    return result;
  };
  witnesses: for (const a of smallPrimes) {
    if (a >= n) continue;
    let x = powMod(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 0; i < r - 1; i++) {
      x = (x * x) % n;
      if (x === n - 1n) continue witnesses;
    }
    return false;
  }
  return true;
}

/** Lucas-Lehmer: 2^p - 1 is prime (p an odd prime) iff s_(p-2) = 0, s_0 = 4, s_i = s_(i-1)^2 - 2
 *  mod (2^p - 1). p = 2 (M_2 = 3) is the one base case outside the recurrence's domain. */
function isMersennePrimeExponent(p: number): boolean {
  if (p === 2) return true;
  if (!isPrime(p)) return false;
  const m = (1n << BigInt(p)) - 1n;
  let s = 4n;
  for (let i = 0; i < p - 2; i++) {
    s = (s * s - 2n) % m;
    if (s < 0n) s += m;
  }
  return s === 0n;
}

/** Exponents beyond this give 2^p - 1 > Number.MAX_SAFE_INTEGER (2^53 - 1): the value exists
 *  and is well-defined, but this family's scalar element can't carry it exactly. */
const MERSENNE_EXPONENT_LIMIT = 53;

let mersennePrimesCache: number[] | undefined;
function mersennePrimesTable(): number[] {
  if (!mersennePrimesCache) {
    mersennePrimesCache = [];
    for (let p = 2; p <= MERSENNE_EXPONENT_LIMIT; p++) {
      if (isMersennePrimeExponent(p)) mersennePrimesCache.push(Number((1n << BigInt(p)) - 1n));
    }
  }
  return mersennePrimesCache;
}

let fibonacciPrimesCache: number[] | undefined;
function fibonacciPrimesTable(): number[] {
  if (!fibonacciPrimesCache) {
    const table: number[] = [];
    const limit = BigInt(Number.MAX_SAFE_INTEGER);
    let [a, b] = [0n, 1n];
    while (b <= limit) {
      if (isPrimeBig(b)) table.push(Number(b));
      [a, b] = [b, a + b];
    }
    fibonacciPrimesCache = table;
  }
  return fibonacciPrimesCache;
}

export const entries: NumberKernel[] = [
  {
    head: "HarshadNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => harshadCache.nth(r + 1),
    valid: (element) => isHarshad(Number(element)),
    rank: (element) => harshadCache.rankOf(Number(element)),
  },
  {
    head: "HappyNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => happyCache.nth(r + 1),
    valid: (element) => isHappy(Number(element)),
    rank: (element) => happyCache.rankOf(Number(element)),
  },
  {
    head: "NarcissisticNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => NARCISSISTIC_COUNT,
    unrank: (_p, r) => (r >= 0 && r < NARCISSISTIC_NUMBERS.length ? narrow(NARCISSISTIC_NUMBERS[r]) : Number.NaN),
    valid: (element) => {
      const x = toBigNarcissistic(element);
      return x !== undefined && isNarcissisticBig(x);
    },
    rank: (element) => {
      const x = toBigNarcissistic(element);
      return x === undefined ? -1 : NARCISSISTIC_NUMBERS.indexOf(x);
    },
  },
  {
    head: "AutomorphicNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => {
      const table = automorphicNumbersTable();
      return r < table.length ? table[r] : Number.NaN;
    },
    valid: (element) => isAutomorphic(Number(element)),
    rank: (element) => automorphicNumbersTable().indexOf(Number(element)),
  },
  {
    head: "KaprekarNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => kaprekarCache.nth(r + 1),
    valid: (element) => isKaprekar(Number(element)),
    rank: (element) => kaprekarCache.rankOf(Number(element)),
  },
  {
    head: "EvilNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => evilCache.nth(r + 1),
    valid: (element) => isEvil(Number(element)),
    rank: (element) => evilCache.rankOf(Number(element)),
  },
  {
    head: "OdiousNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => odiousCache.nth(r + 1),
    valid: (element) => isOdious(Number(element)),
    rank: (element) => odiousCache.rankOf(Number(element)),
  },
  {
    head: "PerniciousNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => perniciousCache.nth(r + 1),
    valid: (element) => isPernicious(Number(element)),
    rank: (element) => perniciousCache.rankOf(Number(element)),
  },
  {
    head: "SmithNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => smithCache.nth(r + 1),
    valid: (element) => isSmith(Number(element)),
    rank: (element) => smithCache.rankOf(Number(element)),
  },
  {
    head: "SemiprimeNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => semiprimeCache.nth(r + 1),
    valid: (element) => isSemiprime(Number(element)),
    rank: (element) => semiprimeCache.rankOf(Number(element)),
  },
  {
    head: "SquarefreeSemiprimes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => squarefreeSemiprimeCache.nth(r + 1),
    valid: (element) => isSquarefreeSemiprime(Number(element)),
    rank: (element) => squarefreeSemiprimeCache.rankOf(Number(element)),
  },
  {
    head: "SphenicNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => sphenicCache.nth(r + 1),
    valid: (element) => isSphenic(Number(element)),
    rank: (element) => sphenicCache.rankOf(Number(element)),
  },
  {
    head: "PrimePowerNumbers",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => primePowerCache.nth(r + 1),
    valid: (element) => isPrimePower(Number(element)),
    rank: (element) => primePowerCache.rankOf(Number(element)),
  },
  {
    declared: {
      carrier: "Numeric",
      params: [{ name: "k", role: "param", min: 0 }],
      cost: { count: "closed", unrank: "scan", rank: "scan", valid: "polynomial" },
    },
    head: "KAlmostPrimes",
    paramCount: 1,
    kind: "scalar",
    // Ω(n) = 0 only for n = 1, and never below: {1} and {}, finite, where a scan for more
    // would never end.
    count: ([k]) => (k < 0 ? 0 : k === 0 ? 1 : Number.POSITIVE_INFINITY),
    unrank: ([k], r) => (k <= 0 ? (k === 0 && r === 0 ? 1 : Number.NaN) : kAlmostCacheFor(k).nth(r + 1)),
    valid: (element, [k]) => omega(Number(element)) === k,
    rank: (element, [k]) => kAlmostCacheFor(k).rankOf(Number(element)),
  },
  {
    head: "RoughNumbers",
    paramCount: 1,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: ([k], r) => roughCacheFor(k).nth(r + 1),
    valid: (element, [k]) => isRough(Number(element), k),
    rank: (element, [k]) => roughCacheFor(k).rankOf(Number(element)),
  },
  {
    head: "TwinPrimes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    unrank: (_p, r) => twinPrimeCache.nth(r + 1),
    valid: (element) => isTwinPrime(Number(element)),
    rank: (element) => twinPrimeCache.rankOf(Number(element)),
  },
  {
    head: "CousinPrimes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    unrank: (_p, r) => cousinPrimeCache.nth(r + 1),
    valid: (element) => isCousinPrime(Number(element)),
    rank: (element) => cousinPrimeCache.rankOf(Number(element)),
  },
  {
    head: "SexyPrimes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    unrank: (_p, r) => sexyPrimeCache.nth(r + 1),
    valid: (element) => isSexyPrime(Number(element)),
    rank: (element) => sexyPrimeCache.rankOf(Number(element)),
  },
  {
    head: "SophieGermainPrimes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    unrank: (_p, r) => sophieGermainCache.nth(r + 1),
    valid: (element) => isSophieGermainPrime(Number(element)),
    rank: (element) => sophieGermainCache.rankOf(Number(element)),
  },
  {
    head: "SafePrimes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    unrank: (_p, r) => safePrimeCache.nth(r + 1),
    valid: (element) => isSafePrime(Number(element)),
    rank: (element) => safePrimeCache.rankOf(Number(element)),
  },
  {
    declared: {
      carrier: "Numeric",
      params: [{ name: "gap", role: "param", min: 1 }],
      cost: { count: "closed", unrank: "scan", rank: "scan", valid: "polynomial" },
    },
    head: "PrimePairs",
    paramCount: 1,
    kind: "scalar",
    // An odd gap pairs an odd prime with an even number, so one of the pair is 2: at most
    // {2} (or {2 − gap}), finite, where a scan for more would never end. Even gaps are open.
    count: ([gap]) => (gap % 2 !== 0 ? oddGapPairs(gap).length : Number.NaN),
    unrank: ([gap], r) => (gap % 2 !== 0 ? (oddGapPairs(gap)[r] ?? Number.NaN) : primePairCacheFor(gap).nth(r + 1)),
    valid: (element, [gap]) => isPrime(Number(element)) && isPrime(Number(element) + gap),
    rank: (element, [gap]) =>
      gap % 2 !== 0 ? oddGapPairs(gap).indexOf(Number(element)) : primePairCacheFor(gap).rankOf(Number(element)),
  },
  {
    head: "PalindromicPrimes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    unrank: (_p, r) => palindromicPrimeCache.nth(r + 1),
    valid: (element) => isPalindromicPrime(Number(element)),
    rank: (element) => palindromicPrimeCache.rankOf(Number(element)),
  },
  {
    head: "CircularPrimes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    unrank: (_p, r) => circularPrimeCache.nth(r + 1),
    valid: (element) => isCircularPrime(Number(element)),
    rank: (element) => circularPrimeCache.rankOf(Number(element)),
  },
  {
    head: "EmirpPrimes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    unrank: (_p, r) => emirpCache.nth(r + 1),
    valid: (element) => isEmirp(Number(element)),
    rank: (element) => emirpCache.rankOf(Number(element)),
  },
  {
    head: "MersennePrimes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    unrank: (_p, r) => {
      const table = mersennePrimesTable();
      return r < table.length ? table[r] : Number.NaN;
    },
    valid: (element) => mersennePrimesTable().includes(Number(element)),
    rank: (element) => mersennePrimesTable().indexOf(Number(element)),
  },
  {
    head: "FibonacciPrimes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.NaN,
    unrank: (_p, r) => {
      const table = fibonacciPrimesTable();
      return r < table.length ? table[r] : Number.NaN;
    },
    valid: (element) => fibonacciPrimesTable().includes(Number(element)),
    rank: (element) => fibonacciPrimesTable().indexOf(Number(element)),
  },
];
