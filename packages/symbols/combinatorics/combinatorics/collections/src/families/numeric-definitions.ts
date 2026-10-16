// The numeric sequences defined in Epsil: fibers with no end whose elements are the terms of a
// sequence (kind "scalar"), in the order of the sequence. A term is a closed form in its rank, and
// the rank of a term an estimate of that form's inverse, checked against the ranks round about it.
// The TS kernels (./numeric-closed-form.ts, ./numeric-sets.ts) stay as the fast paths while a term
// is a safe integer; past that the interpreter's exact integers answer (./epsil.ts).

import type { EpsilFamily, FastKernel } from "./epsil.ts";
import { add, equal, fold, iff, less, mul, sub, upTo } from "./tables.ts";
import type { Declared, NumberKernel } from "./types.ts";

type MathJSON = unknown;

const INFINITY = "PositiveInfinity";
const sqrt = (x: MathJSON): MathJSON => ["Sqrt", x];
const floor = (x: MathJSON): MathJSON => ["Floor", x];
const power = (a: MathJSON, b: MathJSON): MathJSON => ["Power", a, b];
const binomial = (n: MathJSON, k: MathJSON): MathJSON => ["Binomial", n, k];

interface Sequence {
  readonly head: string;
  /** The names the definitions give the sequence's params, in order. */
  readonly params?: readonly string[];
  /** Where a param makes it no sequence at all: 0 there. */
  readonly count?: MathJSON;
  /** The term at 0-based rank `r`. A double holds it exactly where it is a safe integer, if each
   *  step does: a product goes before the division that makes it smaller. */
  readonly term: (r: MathJSON) => MathJSON;
  /** The rank of the term `_x`, to within one, where `_x` is a term: an estimate, not a search. It is
   *  read only for an `_x` of at least 1, and not through `Max`, which compute-engine leaves
   *  unevaluated on a big integer. */
  readonly estimate: MathJSON;
}

/**
 * A sequence that increases strictly, as a family: the rank of `_x` is the rank, among those
 * within one of the estimate, whose term is `_x`, and `_x` is a member where there is one. (A
 * sequence that repeats a term needs a rank of its own: the first place it occurs.)
 */
export function sequence({ head, params = [], count = INFINITY, term, estimate }: Sequence): EpsilFamily {
  const [found, rank] = ["sq_found", "sq_r"];
  const around = fold(
    iff(equal(term(rank), "_x"), rank, found),
    found,
    rank,
    -1,
    upTo(["Max", 0, sub(estimate, 1)], add(estimate, 1)),
  );
  return {
    head,
    paramCount: params.length as 0 | 1,
    kind: "scalar",
    params,
    // The last step of the search is left unreduced by the interpreter (a bare `Reduce`).
    settle: true,
    epsil: {
      count,
      unrank: term("_r"),
      rank: around,
      valid: iff(less("_x", 1), "False", ["GreaterEqual", around, 0]),
    },
  };
}

/** The rank, one short of the n that `a n² + b n + c = d x` gives for `_x`: an estimate of the rank
 *  of `_x` among the terms (a n² + b n + c) / d, n = 1, 2, …. */
const quadraticRank = (a: MathJSON, b: MathJSON, c: MathJSON, d: MathJSON): MathJSON => {
  const discriminant = sub(add(power(b, 2), mul(4, a, d, "_x")), mul(4, a, c));
  return sub(floor(["Divide", add(["Negate", b], sqrt(discriminant)), mul(2, a)]), 1);
};

/** The quadratic sequence (a n² + b n + c) / d at n = 1, 2, …, whose term `term(n)` is written
 *  to keep a double exact. */
const quadratic = (
  head: string,
  [a, b, c, d]: readonly [MathJSON, MathJSON, MathJSON, MathJSON],
  term: (n: MathJSON) => MathJSON,
  options: Pick<Sequence, "params" | "count"> = {},
): EpsilFamily => sequence({ head, ...options, term: (r) => term(add(r, 1)), estimate: quadraticRank(a, b, c, d) });

/** The `r`th root of `x`, rounded down, less `shift`: an estimate of a rank among terms near `x ≈ n^r` times a
 *  constant, which `shift` brings to the rank (n is one more than the rank). */
const rootRank = (r: number, scale: number, shift: number): MathJSON =>
  floor(sub(["Root", mul(scale, "_x"), r], shift));

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
  quadratic("TriangularNumbers", [1, 1, 0, 2], halfProduct(1, -1)),
  quadratic("PentagonalNumbers", [3, -1, 0, 2], halfProduct(3, 1)),
  quadratic("HexagonalNumbers", [4, -2, 0, 2], halfProduct(4, 2)),
  quadratic("HeptagonalNumbers", [5, -3, 0, 2], halfProduct(5, 3)),
  quadratic("OctagonalNumbers", [6, -4, 0, 2], halfProduct(6, 4)),
  quadratic("CenteredTriangularNumbers", [3, -3, 2, 2], (n) => add(mul(3, ["Divide", mul(n, sub(n, 1)), 2]), 1)),
  quadratic("CenteredSquareNumbers", [2, -2, 1, 1], centered(2)),
  quadratic("CenteredHexagonalNumbers", [3, -3, 1, 1], centered(3)),
  quadratic("StarNumbers", [6, -6, 1, 1], centered(6)),
  quadratic("PronicNumbers", [1, 1, 0, 1], (n) => mul(n, add(n, 1))),
  quadratic("SquareNumbers", [1, 0, 0, 1], (n) => mul(n, n)),
  // The polygon has at least 3 sides: below that the formula is no polygonal-number sequence.
  quadratic("PolygonalNumbers", [sub("_k", 2), sub(4, "_k"), 0, 2], halfProduct(sub("_k", 2), sub("_k", 4)), {
    params: ["_k"],
    count: iff(less("_k", 3), 0, INFINITY),
  }),
  // Cubic and quartic terms, as binomials, which compiled code holds exactly wherever the term is a safe integer
  // (a product with the division after it would not). The estimate is the real root of the leading term, less
  // what the lower ones shift it by.
  sequence({ head: "CubeNumbers", term: (r) => power(add(r, 1), 3), estimate: rootRank(3, 1, 1) }),
  sequence({ head: "TetrahedralNumbers", term: (r) => binomial(add(r, 3), 3), estimate: rootRank(3, 6, 1) }),
  sequence({ head: "PentatopeNumbers", term: (r) => binomial(add(r, 4), 4), estimate: rootRank(4, 24, 2.5) }),
  sequence({
    head: "SquarePyramidalNumbers",
    term: (r) => add(binomial(add(r, 3), 3), binomial(add(r, 2), 3)),
    estimate: rootRank(3, 3, 1.5),
  }),
  sequence({ head: "PowersOfTwo", term: (r) => power(2, r), estimate: floor(["Log", "_x", 2]) }),
  allOnes,
];

/** The definitions, by head. */
export const definitions: ReadonlyMap<string, EpsilFamily> = new Map(families.map((family) => [family.head, family]));

/** A TS kernel as a fast path: the terms it holds exactly are plain numbers, and it declines the rest. */
const fastOf = (kernel: NumberKernel): FastKernel => ({
  count: (p) => kernel.count(p),
  unrank: (p, r) => {
    const term = kernel.unrank(p, r);
    return typeof term === "number" && Number.isSafeInteger(term) ? term : undefined;
  },
  rank: (element, p) => kernel.rank(element, p),
  valid: (element, p) => kernel.valid(element, p),
});

/** The kernels, each replaced by its Epsil definition where there is one: that, with the kernel as
 *  its fast path and its Plausible declaration. */
export const withDefinitions = (kernels: readonly NumberKernel[]): (NumberKernel | EpsilFamily)[] =>
  kernels.map((kernel) => {
    const definition = definitions.get(kernel.head);
    if (definition === undefined) return kernel;
    const declared: Declared | undefined = kernel.declared;
    return { ...definition, ...(declared === undefined ? {} : { declared }), fast: fastOf(kernel) };
  });
