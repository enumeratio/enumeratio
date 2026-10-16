// The numeric sets that are "the integers satisfying a predicate", defined in Epsil as fibers with no end
// whose elements are the members in increasing order (kind "scalar"). Epsil has no unbounded search, so
// each family states a proven upper bound for its n-th member and the definitions scan the integers up to
// it: the n-th member is the n-th integer in [1, bound(n)] that passes the predicate, the rank of a member
// is how many pass below it, and membership is the predicate. A family whose n-th member has no proven
// bound (the prime-pair families, Harshad, Happy, …) has no definition here.
//
// The predicates are the definitions' own, by trial division: a scan costs the sum of those over the
// integers up to the bound, so the interpreter answers ranks of tens to hundreds. The TS kernels (sieves
// and caches) stay as the fast paths and keep their reach.

import type { EpsilFamily } from "./epsil.ts";
import { type FastReach, withDefinitions } from "./numeric-definitions.ts";
import { add, all, and, at, equal, fold, iff, less, lets, mul, sub, upTo } from "./tables.ts";
import type { NumberKernel } from "./types.ts";

type MathJSON = unknown;

const INFINITY = "PositiveInfinity";
const floor = (x: MathJSON): MathJSON => ["Floor", x];
const log2 = (x: MathJSON): MathJSON => ["Log", x, 2];
const power = (a: MathJSON, b: MathJSON): MathJSON => ["Power", a, b];
const mod = (a: MathJSON, b: MathJSON): MathJSON => ["Mod", a, b];
const atLeast = (a: MathJSON, b: MathJSON): MathJSON => ["GreaterEqual", a, b];
const greater = (a: MathJSON, b: MathJSON): MathJSON => ["Greater", a, b];
/** ⌊√n⌋, or one more where the root rounds up past an integer: a trial division only needs a bound at least that. */
const root = (n: MathJSON): MathJSON => floor(["Sqrt", n]);
const divides = (d: MathJSON, n: MathJSON): MathJSON => equal(mod(n, d), 0);

/** A question's limit: the greatest rank or number, or a test of it that reads the params. */
type Limit = number | ((x: number, p: readonly number[]) => boolean);

/** How a family is scanned. */
export interface Scan {
  readonly head: string;
  /** The names the definitions give the family's params, in order. */
  readonly params?: readonly string[];
  /** Where a param makes the set finite or empty (default no end). */
  readonly count?: MathJSON;
  /** Whether the integer `n` (at least 1) is a member. */
  readonly member: (n: MathJSON) => MathJSON;
  /** At least the n-th member (n ≥ 1), proven in a comment where it is stated. */
  readonly bound: (n: MathJSON) => MathJSON;
  /** How far the interpreter alone answers in a second or so (measured): the farthest rank, member whose
   *  rank is asked, and number whose membership is. Past that the definition declines; the TS kernel answers. */
  readonly reach: { readonly unrank: Limit; readonly rank: Limit; readonly member: Limit };
}

const beyond =
  (limit: Limit) =>
  (x: unknown, p: readonly number[]): "decline" | undefined =>
    (typeof limit === "number" ? Number(x) <= limit : limit(Number(x), p)) ? undefined : "decline";

/**
 * The scan of ./scan-definitions.ts. The fold over [1, bound] keeps one integer: minus the members
 * passed so far, until the one at the rank is met, then that member (the first positive value ends the
 * count). A bound that is too small leaves a count where the member should be: that is NaN, which the
 * kernel refuses, never a value (tests/scan-epsil.test.ts also holds every bound to the n-th member).
 */
export function scan({ head, params = [], count = INFINITY, member, bound, reach }: Scan): EpsilFamily {
  const [state, k, passed] = ["sn_s", "sn_k", "sn_c"];
  const found = "sn_f";
  const unrank = lets(
    [
      [
        found,
        fold(
          iff(greater(state, 0), state, iff(member(k), iff(equal(add(state, "_r"), 0), k, sub(state, 1)), state)),
          state,
          k,
          0,
          upTo(1, bound(add("_r", 1))),
        ),
        "integer",
      ],
    ],
    iff(greater(found, 0), found, "NaN"),
  );
  const valid = iff(atLeast("_x", 1), member("_x"), "False");
  const place = fold(iff(member(k), add(passed, 1), passed), passed, k, 0, upTo(1, sub("_x", 1)));
  return {
    head,
    paramCount: params.length as 0 | 1,
    kind: "scalar",
    params,
    settle: true,
    epsil: { count, unrank, rank: iff(valid, place, -1), valid },
    early: { unrank: beyond(reach.unrank), rank: beyond(reach.rank), member: beyond(reach.member) },
  };
}

// ---- Predicates, each by trial division. ----

/** n ≥ 2 with no divisor from 2 to ⌊√n⌋. */
const prime = (n: MathJSON): MathJSON =>
  and(
    atLeast(n, 2),
    all((d) => ["NotEqual", mod(n, d), 0], upTo(2, root(n)), "pd"),
  );

/** σ(n) − n, the sum of the proper divisors, in pairs d, n/d for d up to ⌊√n⌋. */
const aliquot = (n: MathJSON): MathJSON => {
  const [sum, d] = ["al_a", "al_d"];
  const pair = iff(equal(["Divide", n, d], d), d, add(d, ["Divide", n, d]));
  return iff(less(n, 2), 0, fold(iff(divides(d, n), add(sum, pair), sum), sum, d, 1, upTo(2, root(n))));
};

/**
 * (Ω(n), ω(n)): how many primes divide n, with and without multiplicity, by one trial-division walk. The
 * state is what is left of n (m), the divisor tried (d), the two counts, and whether d has divided yet;
 * it divides d out while it can, then moves on, and stops when d² passes m, where m is 1 or a prime.
 */
function shape(n: MathJSON, then: (big: MathJSON, small: MathJSON) => MathJSON): MathJSON {
  const [walk, step, ended] = ["fw_w", "fw_i", "fw_e"];
  const [m, d, big, small, hit] = [1, 2, 3, 4, 5].map((j) => at(walk, j));
  const body = iff(
    greater(mul(d, d), m),
    walk,
    iff(
      divides(d, m),
      ["List", ["Divide", m, d], d, add(big, 1), add(small, sub(1, hit)), 1],
      ["List", m, add(d, 1), big, small, 0],
    ),
  );
  // The divisor moves on at most ⌊√n⌋ times and divides at most ⌊log₂ n⌋.
  const walked = fold(body, walk, step, ["List", n, 2, 0, 0, 0], upTo(1, add(root(n), floor(log2(n)), 2)));
  const [left, last, bigDone, smallDone, hitDone] = [1, 2, 3, 4, 5].map((j) => at(ended, j));
  // A leftover m is a prime that has not divided yet, unless it is the d that did (a cube's last factor).
  const leftover = greater(left, 1);
  return lets(
    [[ended, walked, "list<integer>"]],
    then(
      add(bigDone, iff(leftover, 1, 0)),
      add(smallDone, iff(and(leftover, ["Not", and(equal(left, last), equal(hitDone, 1))]), 1, 0)),
    ),
  );
}

/** n = a²b³ for some b ≤ ∛n and some integer a: every prime of n divides it twice or more. */
const powerful = (n: MathJSON): MathJSON => {
  const [found, b] = ["pw_f", "pw_b"];
  const cube = power(b, 3);
  const rest = ["Divide", n, cube];
  const side = ["Round", ["Sqrt", rest]];
  // The cube root has a margin: floating point puts an exact cube a hair under or over.
  return fold(
    ["Or", found, and(["LessEqual", cube, n], divides(cube, n), equal(mul(side, side), rest))],
    found,
    b,
    "False",
    upTo(1, add(floor(power(n, ["Divide", 1, 3])), 2)),
  );
};

/** n = a^k for some a ≥ 2 and k from 2 to ⌊log₂ n⌋ (the root rounded, and checked by raising it). */
const perfectPower = (n: MathJSON): MathJSON => {
  const [found, e] = ["pp_f", "pp_e"];
  const base = ["Round", power(n, ["Divide", 1, e])];
  return and(
    atLeast(n, 4),
    fold(
      ["Or", found, and(atLeast(base, 2), equal(power(base, e), n))],
      found,
      e,
      "False",
      upTo(2, add(floor(log2(n)), 1)),
    ),
  );
};

/**
 * Whether n has no prime factor above k, by a walk of (what is left of n, the divisor tried): it divides
 * the divisor out while it can, then moves on, and stops when the divisor passes k or nothing is left.
 */
const smooth = (n: MathJSON): MathJSON => {
  const [walk, step] = ["sm_w", "sm_i"];
  const [m, d] = [1, 2].map((j) => at(walk, j));
  const body = iff(
    ["Or", equal(m, 1), greater(d, "_k")],
    walk,
    iff(divides(d, m), ["List", ["Divide", m, d], d], ["List", m, add(d, 1)]),
  );
  // The divisor moves on at most k times and divides at most ⌊log₂ n⌋.
  const walked = fold(body, walk, step, ["List", n, 2], upTo(1, add("_k", floor(log2(n)), 1)));
  return equal(at(walked, 1), 1);
};

// ---- Bounds on the n-th member. ----

/** The n-th prime is below n(ln n + ln ln n) for n ≥ 6 (Rosser and Schoenfeld, "Approximate formulas for
 *  some functions of prime numbers", Illinois J. Math. 6 (1962), (3.13)); the first five are at most 11.
 *  The one added covers a double's rounding of the product. */
const primeBound = (n: MathJSON): MathJSON =>
  iff(less(n, 6), 11, add(floor(mul(n, add(["Ln", n], ["Ln", ["Ln", n]]))), 1));

/** `primeBound` for the reach tests below. */
const primeBoundOf = (n: number): number => (n < 6 ? 11 : Math.floor(n * (Math.log(n) + Math.log(Math.log(n)))) + 1);

// The reaches below are the farthest the interpreter answers within about a second on a laptop, rounded
// down; a question past one is declined, and the fast path (where there is one) answers it.
export const scans: readonly Scan[] = [
  { head: "PrimeNumbers", member: prime, bound: primeBound, reach: { unrank: 100, rank: 600, member: 1e8 } },
  // The n semiprimes 2p over the first n primes p are at most 2·p_n.
  {
    head: "SemiprimeNumbers",
    member: (n) => shape(n, (big) => equal(big, 2)),
    bound: (n) => mul(2, primeBound(n)),
    reach: { unrank: 40, rank: 120, member: 1e7 },
  },
  // 2p over the odd primes p among the first n + 1 primes.
  {
    head: "SquarefreeSemiprimes",
    member: (n) => shape(n, (big, small) => and(equal(big, 2), equal(small, 2))),
    bound: (n) => mul(2, primeBound(add(n, 1))),
    reach: { unrank: 40, rank: 140, member: 1e7 },
  },
  // 6p over the primes p from the third on, among the first n + 2.
  {
    head: "SphenicNumbers",
    member: (n) => shape(n, (big, small) => and(equal(big, 3), equal(small, 3))),
    bound: (n) => mul(6, primeBound(add(n, 2))),
    reach: { unrank: 10, rank: 120, member: 1e7 },
  },
  // The primes are prime powers.
  {
    head: "PrimePowerNumbers",
    member: (n) => shape(n, (_, small) => equal(small, 1)),
    bound: primeBound,
    reach: { unrank: 40, rank: 130, member: 1e7 },
  },
  {
    head: "KAlmostPrimes",
    params: ["_k"],
    // Ω(n) = 0 only for 1, and never below.
    count: iff(less("_k", 0), 0, iff(equal("_k", 0), 1, INFINITY)),
    member: (n) => shape(n, (big) => equal(big, "_k")),
    // 2^(k − 1)·p has Ω = k for every prime p, so the first n primes give n members.
    bound: (n) => iff(less("_k", 1), 1, mul(power(2, sub("_k", 1)), primeBound(n))),
    reach: {
      // The scan runs to the member, about 170 at the last rank of each k.
      unrank: (r, [k]) => k < 1 || r <= ([38, 46, 36, 20, 8, 3, 0][k - 1] ?? -1),
      rank: 170,
      member: 1e7,
    },
  },
  {
    head: "RoughNumbers",
    params: ["_k"],
    // No divisor below k: a composite one would have a prime factor below k too.
    member: (n) => all((d) => ["NotEqual", mod(n, d), 0], upTo(2, sub("_k", 1)), "rf"),
    // 1 and the primes p_k, …, p_(k + n − 2) (a prime p_j is above j).
    bound: (n) => primeBound(add(n, iff(less("_k", 1), 1, "_k"))),
    reach: {
      // A candidate costs a step for each divisor tried, k − 2 of them, and a few more.
      unrank: (r, [k]) => primeBoundOf(r + 1 + Math.max(k, 1)) * (5 + Math.max(k - 2, 0)) <= 30000,
      rank: (x, [k]) => x * (3 + Math.max(k - 2, 0)) <= 12000,
      member: (_, [k]) => k <= 5000,
    },
  },
  {
    head: "AbundantNumbers",
    member: (n) => greater(aliquot(n), n),
    // 6m for m ≥ 2 is abundant, its proper divisors including 1, m, 2m and 3m: the n numbers 12, …, 6(n + 1).
    bound: (n) => mul(6, add(n, 1)),
    reach: { unrank: 100, rank: 420, member: 2e7 },
  },
  {
    head: "DeficientNumbers",
    member: (n) => less(aliquot(n), n),
    // With σ(m)/m = Σ_{d | m} 1/d, the sum of σ(m)/m over m ≤ x is Σ_d ⌊x/d⌋/d < x·π²/6. Each abundant or perfect m
    // adds at least 2 and each deficient m at least 1, so those m number under x(π²/6 − 1) < 0.65x, and at x = 3n
    // more than n of the 3n integers are deficient.
    bound: (n) => mul(3, n),
    reach: { unrank: 260, rank: 340, member: 2e7 },
  },
  {
    head: "SquareFreeNumbers",
    member: (n) => all((d) => ["NotEqual", mod(n, mul(d, d)), 0], upTo(2, root(n)), "sf"),
    // The integers up to x with a square p² of a prime dividing them number at most x·Σ_p 1/p² <
    // x(1/4 + Σ_{odd m ≥ 3} 1/m²) = x(1/4 + π²/8 − 1) < 0.49x, so at x = 2n more than n are squarefree.
    bound: (n) => mul(2, n),
    reach: { unrank: 400, rank: 680, member: 1e8 },
  },
  {
    head: "KFreeIntegers",
    params: ["_k"],
    // Below k = 2 only 1 is k-free.
    count: iff(less("_k", 2), 1, INFINITY),
    member: (n) =>
      iff(
        less("_k", 2),
        equal(n, 1),
        all((d) => ["NotEqual", mod(n, power(d, "_k")), 0], upTo(2, root(n)), "kf"),
      ),
    // A squarefree number is k-free for k ≥ 2.
    bound: (n) => iff(less("_k", 2), 1, mul(2, n)),
    reach: { unrank: 400, rank: 500, member: 1e8 },
  },
  {
    head: "SmoothNumbers",
    params: ["_k"],
    // Below k = 2 only 1 is k-smooth.
    count: iff(less("_k", 2), 1, INFINITY),
    member: (n) => iff(less("_k", 2), equal(n, 1), smooth(n)),
    // The powers of 2 are k-smooth for k ≥ 2: 1, 2, …, 2^(n − 1). Loose past k = 2, so only short scans fit.
    bound: (n) => iff(less("_k", 2), 1, power(2, sub(n, 1))),
    reach: {
      // The 2-smooth members double each rank, and a candidate is a walk of k + log₂ steps.
      unrank: (r, [k]) => k < 2 || r <= 8,
      rank: (x, [k]) => x * (k + 8) <= 2500,
      member: (x, [k]) => k <= 2000 && x <= 1e100,
    },
  },
  // The squares are powerful: the n squares 1, …, n².
  {
    head: "PowerfulNumbers",
    member: powerful,
    bound: (n) => power(n, 2),
    reach: { unrank: 20, rank: 330, member: 1e10 },
  },
  // The squares 4, …, (n + 1)².
  {
    head: "PerfectPowerNumbers",
    member: perfectPower,
    bound: (n) => power(add(n, 1), 2),
    reach: { unrank: 16, rank: 300, member: 1e12 },
  },
  {
    head: "AchillesNumbers",
    member: (n) => and(greater(n, 1), powerful(n), ["Not", perfectPower(n)]),
    // 8q² for the odd primes q among the first n + 1 primes: powerful, and no perfect power since the exponents 3
    // and 2 are coprime.
    bound: (n) => mul(8, power(primeBound(add(n, 1)), 2)),
    reach: { unrank: 2, rank: 290, member: 1e10 },
  },
];

/** The definitions, by head. */
export const definitions: ReadonlyMap<string, EpsilFamily> = new Map(scans.map((s) => [s.head, scan(s)]));

/** The kernels, each replaced by its Epsil definition where there is one, as ./numeric-definitions.ts does. */
export const withScanDefinitions = (
  kernels: readonly (NumberKernel | EpsilFamily)[],
  reach: Readonly<Record<string, FastReach>> = {},
): ReturnType<typeof withDefinitions> => withDefinitions(kernels, definitions, reach);
