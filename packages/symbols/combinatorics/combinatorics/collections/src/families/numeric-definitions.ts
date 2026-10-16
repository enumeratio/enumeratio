// The numeric sequences defined in Epsil: fibers with no end whose elements are the terms of a
// sequence (kind "scalar"), in the order of the sequence. A term is a closed form in its rank, and
// the rank of a term is found by binary descent over the ranks, exact at any size. The TS kernels
// (./numeric-closed-form.ts, ./numeric-sets.ts) stay as the fast paths while a term is a safe
// integer, bar the `UNWIRED` ones; past that the interpreter's exact integers answer (./epsil.ts).

import type { EpsilFamily, FastKernel } from "./epsil.ts";
import { add, equal, fold, iff, less, lets, mul, sub } from "./tables.ts";
import type { Declared, NumberKernel } from "./types.ts";

type MathJSON = unknown;

const INFINITY = "PositiveInfinity";
const floor = (x: MathJSON): MathJSON => ["Floor", x];
const log2 = (x: MathJSON): MathJSON => ["Log", x, 2];
const power = (a: MathJSON, b: MathJSON): MathJSON => ["Power", a, b];
const binomial = (n: MathJSON, k: MathJSON): MathJSON => ["Binomial", n, k];

interface Sequence {
  readonly head: string;
  /** The names the definitions give the sequence's params, in order. */
  readonly params?: readonly string[];
  /** Where a param makes it no sequence at all: 0 there. */
  readonly count?: MathJSON;
  /** When the params make a sequence at all (default always): where not, no `_x` is a member. */
  readonly exists?: MathJSON;
  /** The term at 0-based rank `r`. A double holds it exactly where it is a safe integer, if each
   *  step does: a product goes before the division that makes it smaller. */
  readonly term: (r: MathJSON) => MathJSON;
  /** At least the rank of the term `_x`, for an `_x` that is at least 1 (default `_x`, as a term is at
   *  least its rank + 1). Only its size matters: it sets how many steps the descent takes. */
  readonly rankBound?: MathJSON;
  /** The first term is met again at rank 1 (1, 1, 2, …): its rank is 0, the first place it occurs. */
  readonly repeatsFirst?: boolean;
}

/**
 * A sequence that increases strictly, as a family. The rank of `_x` is found exactly, however large:
 * binary descent builds the greatest rank whose term is at most `_x` one bit at a time, and `_x` is a
 * member when that rank's term is `_x`. (No root is taken: compute-engine's are only as precise as its
 * working precision. A sequence that repeats a term needs a rank of its own: the first place it occurs.)
 */
export function sequence({
  head,
  params = [],
  count = INFINITY,
  exists = "True",
  term,
  rankBound = "_x",
  repeatsFirst = false,
}: Sequence): EpsilFamily {
  const [place, bit] = ["sq_at", "sq_b"];
  // 2^(bits + 1) exceeds the rank bound, the most the descent can reach.
  const bits = add(floor(log2(rankBound)), 1);
  const next = add(place, power(2, bit));
  const descent = fold(iff(["LessEqual", term(next), "_x"], next, place), place, bit, 0, ["Range", bits, 0, -1]);
  // The descent is bound once: a term reads its rank more than once.
  const found = (then: (at: string) => MathJSON): MathJSON => lets([[place, descent, "integer"]], then(place));
  // Below 1 there is no term, and where there is no sequence there is no member, whatever the term says.
  const defined = (then: MathJSON): MathJSON => iff(["And", exists, ["GreaterEqual", "_x", 1]], then, "False");
  return {
    head,
    paramCount: params.length as 0 | 1,
    kind: "scalar",
    params,
    // The last step of the descent is left unreduced by the interpreter (a bare `Reduce`).
    settle: true,
    epsil: {
      count,
      unrank: term("_r"),
      rank: iff(
        exists,
        found((at) => iff(equal(term(at), "_x"), repeatsFirst ? iff(equal("_x", term(0)), 0, at) : at, -1)),
        -1,
      ),
      valid: defined(found((at) => equal(term(at), "_x"))),
    },
  };
}

/** The quadratic sequence whose term at n = 1, 2, … is `term(n)`, written to keep a double exact. */
const quadratic = (
  head: string,
  term: (n: MathJSON) => MathJSON,
  options: Pick<Sequence, "params" | "count" | "exists"> = {},
): EpsilFamily => sequence({ head, ...options, term: (r) => term(add(r, 1)) });

/** n (a n − b) / 2, the k-gonal numbers' shape: the product is even, so a double holds it. */
const halfProduct = (a: MathJSON, b: MathJSON) => (n: MathJSON) => ["Divide", mul(n, sub(mul(a, n), b)), 2];
/** a n (n − 1) + 1, the centered numbers' shape. */
const centered = (a: MathJSON) => (n: MathJSON) => add(mul(a, n, sub(n, 1)), 1);

/** The constant sequence 1, 1, 1, …: its one value is first met at rank 0. */
const allOnes: EpsilFamily = {
  head: "AllOnes",
  paramCount: 0,
  kind: "scalar",
  params: [],
  epsil: { count: INFINITY, unrank: 1, rank: 0, valid: equal("_x", 1) },
};

const families: readonly EpsilFamily[] = [
  quadratic("TriangularNumbers", halfProduct(1, -1)),
  quadratic("PentagonalNumbers", halfProduct(3, 1)),
  quadratic("HexagonalNumbers", halfProduct(4, 2)),
  quadratic("HeptagonalNumbers", halfProduct(5, 3)),
  quadratic("OctagonalNumbers", halfProduct(6, 4)),
  quadratic("CenteredTriangularNumbers", (n) => add(mul(3, ["Divide", mul(n, sub(n, 1)), 2]), 1)),
  quadratic("CenteredSquareNumbers", centered(2)),
  quadratic("CenteredHexagonalNumbers", centered(3)),
  quadratic("StarNumbers", centered(6)),
  quadratic("PronicNumbers", (n) => mul(n, add(n, 1))),
  quadratic("SquareNumbers", (n) => mul(n, n)),
  // The polygon has at least 3 sides: below that the formula is no polygonal-number sequence.
  quadratic("PolygonalNumbers", halfProduct(sub("_k", 2), sub("_k", 4)), {
    params: ["_k"],
    count: iff(less("_k", 3), 0, INFINITY),
    exists: ["GreaterEqual", "_k", 3],
  }),
  // Cubic and quartic terms, as binomials, which compiled code holds exactly wherever the term is a safe integer
  // (a product with the division after it would not).
  sequence({ head: "CubeNumbers", term: (r) => power(add(r, 1), 3) }),
  sequence({ head: "TetrahedralNumbers", term: (r) => binomial(add(r, 3), 3) }),
  sequence({ head: "PentatopeNumbers", term: (r) => binomial(add(r, 4), 4) }),
  sequence({
    head: "SquarePyramidalNumbers",
    term: (r) => add(binomial(add(r, 3), 3), binomial(add(r, 2), 3)),
  }),
  // The rank is the exponent, at most the bits of the term.
  {
    ...sequence({ head: "PowersOfTwo", term: (r) => power(2, r), rankBound: add(floor(log2("_x")), 2) }),
    early: { unrank: (r) => (r > MAX_BIGINT_BITS ? "decline" : undefined) },
  },
  allOnes,
];

/** The definitions, by head. */
export const definitions: ReadonlyMap<string, EpsilFamily> = new Map(families.map((family) => [family.head, family]));

/** The most bits a power of two is expanded to, on either path: four million bits is instant, where 2^(10^9) is a heap of digits. */
const MAX_BIGINT_BITS = 2 ** 22;

/** What a TS kernel answers on the fast path beyond the terms a double holds. Its cost can grow with the
 *  rank or the element (a cache of the terms, a scan), so past these it declines and Epsil answers. */
export interface FastReach {
  /** `unrank` also passes on a bigint term (the kernel's own, exact), not only a number. */
  readonly bigTerms?: boolean;
  /** The greatest rank `unrank` answers. */
  readonly unrank?: number;
  /** The greatest element `rank` answers. */
  readonly rank?: number;
}

/** A TS kernel as a fast path: the terms it holds exactly are plain numbers, and it declines the rest. */
export const fastOf = (kernel: NumberKernel, { bigTerms = false, unrank, rank }: FastReach = {}): FastKernel => ({
  count: (p) => kernel.count(p),
  unrank: (p, r) => {
    if (unrank !== undefined && r > unrank) return undefined;
    const term: unknown = kernel.unrank(p, r);
    if (typeof term === "bigint") {
      if (term <= BigInt(Number.MAX_SAFE_INTEGER) && term >= -BigInt(Number.MAX_SAFE_INTEGER)) return Number(term);
      return bigTerms ? (term as unknown as number) : undefined;
    }
    return typeof term === "number" && Number.isSafeInteger(term) ? term : undefined;
  },
  rank: (element, p) => {
    if (rank !== undefined && !(Number(element) <= rank)) return undefined;
    const place = kernel.rank(element, p);
    // A member the kernel's own scan gave up on still has a rank: Epsil's to find.
    return place < 0 && kernel.valid(element, p) ? undefined : place;
  },
  valid: (element, p) => kernel.valid(element, p),
  ...(kernel.bigElements === true ? { bigElements: true as const } : {}),
});

/** Sequences whose TS kernel no longer runs ahead of the definition (BL-225): compiled Epsil is as quick to the
 *  terms a double holds, and the kernel reaches no further (no bigint terms, no ranks Epsil declines). The
 *  kernel stays in its `kernels` list as the independent reading tests/readings/numeric.ts holds the definition to. */
export const UNWIRED: ReadonlySet<string> = new Set([
  "SquareNumbers",
  "AllOnes",
  "ThueMorseNumbers",
  "EvilNumbers",
  "OdiousNumbers",
]);

/** The kernels, each replaced by its Epsil definition where there is one: that, with the kernel as
 *  its fast path (unless `UNWIRED`) and its Plausible declaration. */
export const withDefinitions = (
  kernels: readonly (NumberKernel | EpsilFamily)[],
  catalogue: ReadonlyMap<string, EpsilFamily> = definitions,
  reach: Readonly<Record<string, FastReach>> = { PowersOfTwo: { bigTerms: true, unrank: MAX_BIGINT_BITS - 1 } },
): (NumberKernel | EpsilFamily)[] =>
  kernels.map((kernel) => {
    const definition = catalogue.get(kernel.head);
    if (definition === undefined || "epsil" in kernel) return kernel;
    const declared: Declared | undefined = kernel.declared;
    return {
      ...definition,
      ...(declared === undefined ? {} : { declared }),
      ...(UNWIRED.has(kernel.head) ? {} : { fast: fastOf(kernel, reach[kernel.head]) }),
    };
  });
