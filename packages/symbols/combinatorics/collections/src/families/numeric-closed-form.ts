// Closed-form numeric sets/sequences: every element is `f(n)` for a fixed polynomial or
// product formula, n = 1, 2, 3, … (1-indexed, matching `At(S, 1)` = first element per
// PR #86's convention). No sieving or predicate scanning here — see numeric-sets.ts for
// that flavor (Primes, AbundantNumbers, SmoothNumbers(k)).
//
// Every term is computed over `bigint` and only narrowed to a plain `number` when it's
// still exact there (`Number.isSafeInteger`); past that the raw bigint is returned instead
// (cast through the `FamilyKernel` element type, which predates bigint support and can't be
// widened here — see the FILES boundary in the task that produced this file). `ce.box`
// accepts a bigint directly, so `At`/`Take` on fast-growing sequences (FactorialNumbers,
// PrimorialNumbers, …) stay exact well past 2^53. The one place precision is unavoidably
// capped is membership (`valid`/`rank`): declare.ts decodes a boxed element through
// `intOf`, which is itself capped at `Number.MAX_SAFE_INTEGER` — a shared contract this
// file doesn't own. `Element(hugeValue, FactorialNumbers)` is therefore only reliable
// within that range; direct kernel calls (as in this package's tests) can still pass a
// bigint straight through.
import type { FamilyKernel } from "./types.ts";

const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_BIG = BigInt(Number.MIN_SAFE_INTEGER);

/** bigint -> plain number when exact there, else the bigint itself (still an exact integer,
 *  just not representable as an IEEE double without loss). Cast at the call site, since
 *  `FamilyKernel`'s scalar element type is `number` and this package's FILES boundary
 *  excludes touching types.ts. */
function narrow(x: bigint): number {
  return x >= MIN_SAFE_BIG && x <= MAX_SAFE_BIG ? Number(x) : (x as unknown as number);
}

/** Loosely read an element (number or bigint, whatever the caller has) as a bigint,
 *  or `undefined` if it isn't an integer at all. */
function toBig(x: unknown): bigint | undefined {
  if (typeof x === "bigint") return x;
  if (typeof x === "number" && Number.isInteger(x)) return BigInt(x);
  return undefined;
}

// ---- exact bigint integer sqrt (floor), and the perfect-square test built on it. ----

function isqrt(n: bigint): bigint {
  if (n < 2n) return n < 0n ? 0n : n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

function isPerfectSquare(n: bigint): bigint | undefined {
  if (n < 0n) return undefined;
  const r = isqrt(n);
  return r * r === n ? r : undefined;
}

// ---- generic quadratic term/rank: (a*n^2 + b*n + c) / denom = x, a > 0, denom in {1, 2}.
// Covers every figurate/centered family below (all quadratic in n) by closed-form inversion
// via the quadratic formula, done exactly in bigint (never floating sqrt). ----

function quadraticTerm(a: bigint, b: bigint, c: bigint, denom: bigint, n: bigint): bigint {
  return (a * n * n + b * n + c) / denom;
}

function quadraticRank(a: bigint, b: bigint, c: bigint, denom: bigint, x: bigint): number {
  if (x < 1n) return -1;
  const cc = c - denom * x;
  const disc = b * b - 4n * a * cc;
  const s = isPerfectSquare(disc);
  if (s === undefined) return -1;
  const numer = -b + s;
  const twoA = 2n * a;
  if (numer <= 0n || numer % twoA !== 0n) return -1;
  const n = numer / twoA;
  return n >= 1n ? Number(n - 1n) : -1;
}

function quadraticFamily(head: string, a: bigint, b: bigint, c: bigint, denom: bigint): FamilyKernel {
  return {
    head,
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => narrow(quadraticTerm(a, b, c, denom, BigInt(r + 1))),
    valid: (element) => {
      const x = toBig(element);
      return x !== undefined && quadraticRank(a, b, c, denom, x) >= 0;
    },
    rank: (element) => {
      const x = toBig(element);
      return x === undefined ? -1 : quadraticRank(a, b, c, denom, x);
    },
  };
}

// The k-gonal number P(k, n) = ((k-2)n^2 - (k-4)n) / 2. Shared by PolygonalNumbers(k) (the
// selector) and every fixed-k figurate family below, so k=4 (PolygonalNumbers(4)) and
// SquareNumbers (numeric-sets.ts, unranked as (r+1)^2) necessarily agree termwise.
const polygonalCoeffs = (k: bigint): { a: bigint; b: bigint; c: bigint; denom: bigint } => ({
  a: k - 2n,
  b: -(k - 4n),
  c: 0n,
  denom: 2n,
});

// ---- generic bisection over a monotone-increasing bigint formula, for the cubic/quartic
// figurate families (no closed-form inverse we want to hand-derive per family). ----

function bisectRank(term: (n: bigint) => bigint, x: bigint): number {
  if (x < term(1n)) return -1;
  let lo = 1n;
  let hi = 1n;
  while (term(hi) < x) hi *= 2n;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (term(mid) < x) lo = mid + 1n;
    else hi = mid;
  }
  return term(lo) === x ? Number(lo - 1n) : -1;
}

function monotoneFamily(head: string, term: (n: bigint) => bigint): FamilyKernel {
  return {
    head,
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => narrow(term(BigInt(r + 1))),
    valid: (element) => {
      const x = toBig(element);
      return x !== undefined && bisectRank(term, x) >= 0;
    },
    rank: (element) => {
      const x = toBig(element);
      return x === undefined ? -1 : bisectRank(term, x);
    },
  };
}

// ---- generic growing-cache scan, for families with no algebraic closed form at all
// (Factorial, DoubleFactorial, Primorial): each term only grows from the last, and since
// these all grow super-exponentially the scan for rank/valid never runs more than a few tens
// of steps even against an enormous target. ----

function growingSequence(nextTerm: (index0: number, prev: bigint) => bigint) {
  const cache: bigint[] = [];
  return (n: number): bigint => {
    while (cache.length < n) {
      const index0 = cache.length;
      const prev = index0 === 0 ? 1n : cache[index0 - 1];
      cache.push(nextTerm(index0, prev));
    }
    return cache[n - 1];
  };
}

function scanRank(term: (n: number) => bigint, x: bigint): number {
  if (x < 1n) return -1;
  let n = 1;
  let v = term(1);
  while (v < x) {
    n++;
    v = term(n);
  }
  return v === x ? n - 1 : -1;
}

function scanFamily(head: string, term: (n: number) => bigint): FamilyKernel {
  return {
    head,
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => narrow(term(r + 1)),
    valid: (element) => {
      const x = toBig(element);
      return x !== undefined && scanRank(term, x) >= 0;
    },
    rank: (element) => {
      const x = toBig(element);
      return x === undefined ? -1 : scanRank(term, x);
    },
  };
}

// n! for n = 1, 2, 3, … -- 1, 2, 6, 24, 120, … (OEIS A000142, skipping the duplicate a(0)=1).
const factorialAt = growingSequence((index0, prev) => prev * BigInt(index0 + 1));

// (2n-1)!! for n = 1, 2, 3, … -- 1, 3, 15, 105, … (OEIS A001147, skipping the duplicate
// a(0)=1). Every factor is odd, so this is the double factorial of the ODD numbers only.
const doubleFactorialAt = growingSequence((index0, prev) => prev * BigInt(2 * (index0 + 1) - 1));

function isSmallPrime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

// p_n# = product of the first n primes, n = 1, 2, 3, … -- 2, 6, 30, 210, … (OEIS A002110,
// skipping the empty-product a(0)=1).
let lastPrimorialPrime = 1;
const primorialAt = growingSequence((_index0, prev) => {
  let candidate = lastPrimorialPrime + 1;
  while (!isSmallPrime(candidate)) candidate++;
  lastPrimorialPrime = candidate;
  return prev * BigInt(candidate);
});

export const entries: FamilyKernel[] = [
  // ---- figurate numbers: all k-gonal, P(k, n) = ((k-2)n^2 - (k-4)n)/2. ----
  quadraticFamily("TriangularNumbers", 1n, 1n, 0n, 2n), // P(3, n) = n(n+1)/2, A000217
  quadraticFamily("PentagonalNumbers", 3n, -1n, 0n, 2n), // P(5, n) = n(3n-1)/2, A000326
  quadraticFamily("HexagonalNumbers", 4n, -2n, 0n, 2n), // P(6, n) = n(2n-1), A000384
  quadraticFamily("HeptagonalNumbers", 5n, -3n, 0n, 2n), // P(7, n) = n(5n-3)/2, A000566
  quadraticFamily("OctagonalNumbers", 6n, -4n, 0n, 2n), // P(8, n) = n(3n-2), A000567

  // ---- centered figurate numbers (quadratic, but not of the P(k,n) shape above). ----
  quadraticFamily("CenteredTriangularNumbers", 3n, -3n, 2n, 2n), // (3n^2-3n+2)/2, A005448
  quadraticFamily("CenteredSquareNumbers", 2n, -2n, 1n, 1n), // 2n^2-2n+1, A001844
  quadraticFamily("CenteredHexagonalNumbers", 3n, -3n, 1n, 1n), // 3n^2-3n+1, A003215
  quadraticFamily("StarNumbers", 6n, -6n, 1n, 1n), // 6n^2-6n+1 (hexagram), A003154

  // ---- pronic (oblong) numbers: n(n+1). OEIS A002378 is 0-indexed with a(0)=0; our
  // At(S, 1) = 2 (n=1), so the a(0)=0 term isn't a member of this collection. ----
  quadraticFamily("PronicNumbers", 1n, 1n, 0n, 1n), // n(n+1), A002378 (offset by 1)

  // ---- cubic/quartic figurate numbers: no hand-derived closed-form inverse, bisect. ----
  monotoneFamily("CubeNumbers", (n) => n * n * n), // n^3, A000578
  monotoneFamily("TetrahedralNumbers", (n) => (n * (n + 1n) * (n + 2n)) / 6n), // C(n+2,3), A000292
  monotoneFamily("PentatopeNumbers", (n) => (n * (n + 1n) * (n + 2n) * (n + 3n)) / 24n), // C(n+3,4), A000332
  monotoneFamily("SquarePyramidalNumbers", (n) => (n * (n + 1n) * (2n * n + 1n)) / 6n), // A000330

  // ---- powers of two: direct formula and bit-trick invert, no need to bisect. At(S, 1) =
  // 2^0 = 1, matching OEIS A000079 (a(0) = 1). ----
  {
    head: "PowersOfTwo",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: (_p, r) => narrow(2n ** BigInt(r)),
    valid: (element) => {
      const x = toBig(element);
      return x !== undefined && x >= 1n && (x & (x - 1n)) === 0n;
    },
    rank: (element) => {
      const x = toBig(element);
      if (x === undefined || x < 1n || (x & (x - 1n)) !== 0n) return -1;
      let r = 0;
      let v = x;
      while (v > 1n) {
        v >>= 1n;
        r++;
      }
      return r;
    },
  },

  // ---- no algebraic closed form: grow a cache, scan it for membership. ----
  scanFamily("FactorialNumbers", factorialAt),
  scanFamily("DoubleFactorialNumbers", doubleFactorialAt),
  scanFamily("PrimorialNumbers", primorialAt),

  // ---- the constant sequence 1, 1, 1, … -- every term is 1, so `rank` picks the first
  // (0-indexed) match for the one value the family contains. ----
  {
    head: "AllOnes",
    paramCount: 0,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: () => 1,
    valid: (element) => toBig(element) === 1n,
    rank: (element) => (toBig(element) === 1n ? 0 : -1),
  },

  // ---- PolygonalNumbers(k): the one-parameter selector generalizing every fixed-k family
  // above. k=4 reproduces SquareNumbers (numeric-sets.ts) termwise. ----
  {
    head: "PolygonalNumbers",
    paramCount: 1,
    kind: "scalar",
    count: () => Number.POSITIVE_INFINITY,
    unrank: ([k], r) => {
      const { a, b, c, denom } = polygonalCoeffs(BigInt(k));
      return narrow(quadraticTerm(a, b, c, denom, BigInt(r + 1)));
    },
    valid: (element, [k]) => {
      const x = toBig(element);
      if (x === undefined) return false;
      const { a, b, c, denom } = polygonalCoeffs(BigInt(k));
      return quadraticRank(a, b, c, denom, x) >= 0;
    },
    rank: (element, [k]) => {
      const x = toBig(element);
      if (x === undefined) return -1;
      const { a, b, c, denom } = polygonalCoeffs(BigInt(k));
      return quadraticRank(a, b, c, denom, x);
    },
  },
];
