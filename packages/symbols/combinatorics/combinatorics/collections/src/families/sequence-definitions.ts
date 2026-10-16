// The numeric sequences with no single closed form, defined in Epsil as fibers with no end whose elements
// are their terms (kind "scalar"), as ./numeric-definitions.ts does for the closed-form ones: the linear
// recurrences, the factorials and Catalan numbers (a term from the one before), Motzkin, Delannoy and
// Schröder numbers (a sum), and the sequences of a number's binary digits. The TS kernels stay as the fast
// paths while a term is a safe integer; past that the interpreter's exact integers answer (./epsil.ts).
//
// Compiled code computes in doubles, so each definition keeps every intermediate value no greater than
// the term it finds: sums of what is added to, a quotient taken before the product it scales, and
// binomials (which compile exactly while they are safe). A term past 2^53 then comes out past it too,
// and the kernel reads it as one the interpreter must answer.

import type { EpsilFamily } from "./epsil.ts";
import { type FastReach, sequence, withDefinitions } from "./numeric-definitions.ts";
import { and, at, equal, fold, iff, less, lets, mul, quotient, sub, add } from "./tables.ts";
import type { NumberKernel } from "./types.ts";

type MathJSON = unknown;

const INFINITY = "PositiveInfinity";
const floor = (x: MathJSON): MathJSON => ["Floor", x];
const log2 = (x: MathJSON): MathJSON => ["Log", x, 2];
const upTo = (to: MathJSON): MathJSON => ["Range", 0, to, 1];

/** The ranks the interpreter folds over before a term is too far out to wait for. */
const REACH = 5000;
/** The same for a term that is a sum of binomials, which costs more than a rank's worth of steps. */
const SUMMED_REACH = 600;

interface Walk {
  readonly head: string;
  /** The first terms: the state a step reads, from the term at rank `n` on. */
  readonly seed: readonly number[];
  /** The term after the state's, `t(1)` being the term at rank `n`. */
  readonly next: (t: (j: number) => MathJSON, n: MathJSON) => MathJSON;
  /** The rank from which the terms never decrease: past it, a term above `_x` ends the scan. */
  readonly from?: number;
  /** At least how many ranks each bit of a term adds (the reciprocal of its growth's base-2 logarithm, rounded up). */
  readonly perBit: number;
  /** The bits of the largest member whose membership and rank the scan answers in a second or two (measured):
   *  the scan takes about as many steps as the member has ranks, each on a number that size. */
  readonly maxBits: number;
}

/**
 * A sequence read off the few terms before each: a fold over the ranks steps a window of the terms
 * forward. The rank of `_x` is the first place a scan of the terms finds it, so a sequence may dip
 * early or repeat a term; the scan covers `perBit` ranks for each bit of `_x`, and stops at the first
 * term above it once the terms no longer decrease (`from`).
 */
function walked({ head, seed, next, from = 0, perBit, maxBits }: Walk): EpsilFamily {
  const [window, n] = ["wk_w", "wk_n"];
  const k = seed.length;
  const t = (j: number): MathJSON => at(window, j);
  const slide = (...extra: MathJSON[]): MathJSON => [
    "List",
    ...Array.from({ length: k - 1 }, (_, j) => t(j + 2)),
    next(t, n),
    ...extra,
  ];
  // The window after `r` steps starts at the term of rank `r`.
  const term = (r: MathJSON): MathJSON => at(fold(slide(), window, n, ["List", ...seed], upTo(sub(r, 1))), 1);
  // A dozen ranks cover the first terms, which may be small for their rank.
  const bound = add(floor(mul(perBit, log2(add("_x", 2)))), 12);
  // The window and the first rank whose term is `_x` (or -1): a step records the place before it moves on,
  // and holds still once past `_x`, so the terms stop growing.
  const found = at(window, k + 1);
  const step = iff(
    and(["GreaterEqual", n, from], ["Greater", t(1), "_x"]),
    window,
    slide(iff(and(less(found, 0), equal(t(1), "_x")), n, found)),
  );
  const place = at(fold(step, window, n, ["List", ...seed, -1], upTo(bound)), k + 1);
  return {
    head,
    paramCount: 0,
    kind: "scalar",
    params: [],
    epsil: {
      count: INFINITY,
      unrank: term("_r"),
      rank: iff(["GreaterEqual", "_x", 0], place, -1),
      valid: iff(["GreaterEqual", "_x", 0], ["GreaterEqual", place, 0], "False"),
    },
    early: {
      member: (x) => (typeof x === "bigint" && x >= 1n << BigInt(maxBits) ? "decline" : undefined),
      unrank: (r) => (r > REACH ? "decline" : undefined),
    },
  };
}

/** C(2k, k) − C(2k, k + 1), the Catalan number at k: each binomial is exact while it is a safe integer. */
const catalanAt = (k: MathJSON): MathJSON => [
  "Subtract",
  ["Binomial", mul(2, k), k],
  ["If", ["Less", mul(2, k), add(k, 1)], 0, ["Binomial", mul(2, k), add(k, 1)]],
];

/** The sum of `term(k)` for k = 0..`upper`. */
const total = (upper: MathJSON, term: (k: MathJSON) => MathJSON): MathJSON =>
  fold(add("sm_a", term("sm_k")), "sm_a", "sm_k", 0, upTo(upper));

/** The large Schröder number at `r`: S(r) = Σ C(r + k, r − k) Cat(k). */
const schroder = (r: MathJSON): MathJSON => total(r, (k) => mul(["Binomial", add(r, k), sub(r, k)], catalanAt(k)));

/**
 * A sequence that is a sum of non-negative terms and does not decrease, ranked by the binary descent of
 * ./numeric-definitions.ts: its terms are sums, and a sum of binomials of the rank is exact in doubles
 * while the term is.
 */
const summed = (head: string, maxBits: number, term: (r: MathJSON) => MathJSON, repeatsFirst = false): EpsilFamily => ({
  ...sequence({
    head,
    term,
    // Each term is at least 2^(rank − 1), so the rank is at most the bits of the term, plus one.
    rankBound: add(floor(log2("_x")), 2),
    repeatsFirst,
  }),
  // A term is a sum of as many binomials as its rank, and the descent tries a few ranks.
  early: {
    member: (x) => (typeof x === "bigint" && x >= 1n << BigInt(maxBits) ? "decline" : undefined),
    unrank: (r) => (r > SUMMED_REACH ? "decline" : undefined),
  },
});

const parity = (n: MathJSON): MathJSON => {
  const [state, bit] = ["bt_s", "bt_b"];
  // A step reads off the lowest bit of what is left of `n`; 2 + log₂(n + 1) of them cover every bit.
  const bits = add(floor(log2(add(n, 1))), 2);
  return at(
    fold(
      ["List", quotient(at(state, 1), 2), ["Mod", add(at(state, 2), ["Mod", at(state, 1), 2]), 2]],
      state,
      bit,
      ["List", n, 0],
      ["Range", 1, bits, 1],
    ),
    2,
  );
};

/** The numbers whose binary digits have an even (`weight` 0) or odd (1) number of 1s. */
const byWeight = (head: string, weight: 0 | 1): EpsilFamily => ({
  head,
  paramCount: 0,
  kind: "scalar",
  params: [],
  epsil: {
    count: INFINITY,
    // The r-th is 2r with a low bit that completes the parity of r's digits to the weight.
    unrank: add(mul(2, "_r"), weight === 0 ? parity("_r") : sub(1, parity("_r"))),
    rank: iff(and(["GreaterEqual", "_x", 0], equal(parity("_x"), weight)), quotient("_x", 2), -1),
    valid: iff(["GreaterEqual", "_x", 0], equal(parity("_x"), weight), "False"),
  },
});

const thueMorse: EpsilFamily = {
  head: "ThueMorseNumbers",
  paramCount: 0,
  kind: "scalar",
  params: [],
  // Only 0 and 1 occur, first at ranks 0 and 1.
  epsil: {
    count: INFINITY,
    unrank: parity("_r"),
    rank: iff(["Or", equal("_x", 0), equal("_x", 1)], "_x", -1),
    valid: ["Or", equal("_x", 0), equal("_x", 1)],
  },
};

/** The most the rank of a Stern number is searched for: the search tries every neighbour, 1..x. */
const STERN_RANK_LIMIT = 1000;

/**
 * Stern's diatomic sequence s(0) = 0, s(1) = 1, s(2n) = s(n), s(2n + 1) = s(n) + s(n + 1), read off
 * the bits of the rank. Every integer occurs; the first place of x ≥ 2 is the least n with s(n) = x,
 * which is the Calkin–Wilf index of the fraction x/w, over the w coprime to x: the node of the tree
 * found by walking x/w up to 1/1 (a right child where the fraction is above 1, a left child below), the
 * path read as binary digits. The fewest digits are the least index, which no w past x has (w − x has
 * fewer), so w runs over 1..x − 1.
 */
const stern: EpsilFamily = (() => {
  const [bits, bit, best, w, step, walking, ended] = ["st_p", "st_b", "st_best", "st_w", "st_k", "st_s", "st_e"];
  const x = "_x";
  // The registers (s(m), s(m + 1)) of the bits read low first: what is left of the rank, then a, b.
  const [left, a0, b0] = [1, 2, 3].map((j) => at(bits, j));
  const unrank = at(
    fold(
      iff(
        equal(["Mod", left, 2], 0),
        ["List", quotient(left, 2), add(a0, b0), b0],
        ["List", quotient(left, 2), a0, add(a0, b0)],
      ),
      bits,
      bit,
      ["List", "_r", 1, 0],
      ["Range", 1, add(floor(log2(add("_r", 1))), 2), 1],
    ),
    3,
  );
  // The walk's state: the fraction a/b, and the low bits of the path so far (`low`, `len` of them).
  const [a, b, low, len] = [1, 2, 3, 4].map((j) => at(walking, j));
  // One run of the walk: all the subtractions of the smaller from the larger that leave it the larger.
  const ones = quotient(sub(a, 1), b);
  const zeros = quotient(sub(b, 1), a);
  const climb = iff(
    equal(a, b),
    walking,
    iff(
      ["Greater", a, b],
      ["List", sub(a, mul(ones, b)), b, add(low, mul(sub(["Power", 2, ones], 1), ["Power", 2, len])), add(len, ones)],
      ["List", a, sub(b, mul(zeros, a)), low, add(len, zeros)],
    ),
  );
  // A run is at least one subtraction, and the runs of x/w number at most 2 log₂ x + 2 (a Euclid step each).
  const runs = ["Range", 1, add(mul(2, floor(log2(x))), 4), 1];
  // The index of x/w is 1 followed by the path: 2^len + low.
  const least = fold(
    lets(
      [[ended, fold(climb, walking, step, ["List", x, w, 0, 0], runs), "list<integer>"]],
      iff(
        and(equal(["GCD", x, w], 1), less(add(["Power", 2, at(ended, 4)], at(ended, 3)), best)),
        add(["Power", 2, at(ended, 4)], at(ended, 3)),
        best,
      ),
    ),
    best,
    w,
    INFINITY,
    ["Range", 1, sub(x, 1), 1],
  );
  return {
    head: "SternDiatomicSequence",
    paramCount: 0,
    kind: "scalar",
    params: [],
    epsil: {
      count: INFINITY,
      unrank,
      rank: iff(less(x, 2), iff(less(x, 0), -1, x), least),
      valid: ["GreaterEqual", x, 0],
    },
    early: { rank: (element) => ((element as number) > STERN_RANK_LIMIT ? "decline" : undefined) },
  };
})();

const families: readonly EpsilFamily[] = [
  walked({ head: "FibonacciNumbers", seed: [0, 1], perBit: 2, maxBits: 2200, next: (t) => add(t(1), t(2)) }),
  walked({ head: "LucasNumbers", seed: [2, 1], from: 1, perBit: 2, maxBits: 2200, next: (t) => add(t(1), t(2)) }),
  walked({ head: "JacobsthalNumbers", seed: [0, 1], perBit: 2, maxBits: 3000, next: (t) => add(t(2), mul(2, t(1))) }),
  walked({ head: "PellNumbers", seed: [0, 1], perBit: 2, maxBits: 3000, next: (t) => add(mul(2, t(2)), t(1)) }),
  walked({ head: "TribonacciNumbers", seed: [0, 0, 1], perBit: 2, maxBits: 2600, next: (t) => add(t(1), t(2), t(3)) }),
  // P(n + 3) = P(n + 1) + P(n): the term two back in the recurrence of the OEIS, read off the window.
  walked({ head: "PadovanSequence", seed: [1, 0, 0], from: 4, perBit: 3, maxBits: 1300, next: (t) => add(t(1), t(2)) }),
  walked({ head: "PerrinSequence", seed: [3, 0, 2], from: 4, perBit: 3, maxBits: 1300, next: (t) => add(t(1), t(2)) }),
  // n! and (2n − 1)!! as the terms 1!, 2!, … and 1!!, 3!!, …: each the one before times the next factor.
  walked({ head: "FactorialNumbers", seed: [1], perBit: 1, maxBits: 8000, next: (t, n) => mul(t(1), add(n, 2)) }),
  walked({
    head: "DoubleFactorialNumbers",
    seed: [1],
    perBit: 1,
    maxBits: 8000,
    next: (t, n) => mul(t(1), add(mul(2, n), 3)),
  }),
  // Cat(n + 1) = Cat(n) (4n + 2)/(n + 2), the quotient taken first: Cat(n) is divisible by (n + 2)/g
  // for g = gcd(4n + 2, n + 2), and the product after it is the next term, no larger.
  walked({
    head: "CatalanNumbers",
    seed: [1],
    perBit: 1,
    maxBits: 1500,
    next: (t, n) =>
      lets(
        [
          ["ct_g", ["GCD", add(mul(4, n), 2), add(n, 2)], "integer"],
          ["ct_m", ["Divide", add(n, 2), "ct_g"], "integer"],
          ["ct_q", ["Divide", t(1), "ct_m"], "integer"],
          ["ct_u", ["Divide", add(mul(4, n), 2), "ct_g"], "integer"],
        ],
        mul("ct_q", "ct_u"),
      ),
  }),
  // M(n) = Σ C(n, 2k) Cat(k)
  summed(
    "MotzkinNumbers",
    900,
    (r) => total(quotient(r, 2), (k) => mul(["Binomial", r, mul(2, k)], catalanAt(k))),
    true,
  ),
  // D(n) = Σ C(n, k) C(n + k, k)
  summed("CentralDelannoyNumbers", 1000, (r) => total(r, (k) => mul(["Binomial", r, k], ["Binomial", add(r, k), k]))),
  // s(0) = 1, s(n) = S(n)/2
  summed("LittleSchroderNumbers", 700, (r) => iff(equal(r, 0), 1, ["Divide", schroder(r), 2]), true),
  summed("SchroederNumbers", 700, schroder),
  byWeight("EvilNumbers", 0),
  byWeight("OdiousNumbers", 1),
  thueMorse,
  stern,
];

/** The definitions, by head. */
export const definitions: ReadonlyMap<string, EpsilFamily> = new Map(families.map((family) => [family.head, family]));

/** The TS kernels' reach on the fast path. The recurrence kernels cache every term up to the rank, and ran out
 *  of memory (measured: factorials by ~50000 ranks, the rest between 10^5 and 3·10^5), so these stop just short;
 *  the bit kernels scan up to the rank or element, which compiled Epsil answers in closed form past them. */
const REACHES: Readonly<Record<string, FastReach>> = {
  ...Object.fromEntries(
    [
      "FibonacciNumbers",
      "LucasNumbers",
      "JacobsthalNumbers",
      "PellNumbers",
      "TribonacciNumbers",
      "PadovanSequence",
      "PerrinSequence",
      "CatalanNumbers",
      "MotzkinNumbers",
      "CentralDelannoyNumbers",
      "LittleSchroderNumbers",
      "SchroederNumbers",
    ].map((head) => [head, { bigTerms: true, unrank: 100_000 }]),
  ),
  FactorialNumbers: { bigTerms: true, unrank: 30_000 },
  DoubleFactorialNumbers: { bigTerms: true, unrank: 30_000 },
  EvilNumbers: { unrank: 100_000, rank: 200_000 },
  OdiousNumbers: { unrank: 100_000, rank: 200_000 },
  SternDiatomicSequence: { rank: STERN_RANK_LIMIT },
};

/** The kernels, each replaced by its Epsil definition where there is one, as ./numeric-definitions.ts does. */
export const withSequenceDefinitions = (
  kernels: readonly (NumberKernel | EpsilFamily)[],
): ReturnType<typeof withDefinitions> => withDefinitions(kernels, definitions, REACHES);
