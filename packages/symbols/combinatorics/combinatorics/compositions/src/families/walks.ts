// The composition families defined in Epsil: each lists its compositions by the first part that
// differs, smaller first, as a walk (collections/src/families/part-walk.ts) over the sum left and
// a context. Parts drawn from a set need no context; the others carry what the next part depends
// on: the parts to go, the part before, or that part and whether the next must rise or fall.
// Their TS kernels (compositions.ts) stay as the `fast` paths, held to these by
// tests/fast-kernels.test.ts.
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import { partSets, partWalk, type PartWalk } from "../../../collections/src/families/part-walk.ts";
import {
  add,
  all,
  and,
  at,
  equal,
  fold,
  iff,
  less,
  lets,
  map,
  mul,
  quotient,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import type { Declared } from "../../../collections/src/families/types.ts";

type MathJSON = unknown;

const n = "_n";
const k = "_k";
const cap = add(n, 1);

/** Compositions of n whose every part passes `allows`. */
const inSet = (head: string, allows: (p: MathJSON) => MathJSON): EpsilFamily =>
  partWalk({
    head,
    carrier: "Composition",
    paramCount: 1,
    params: [n],
    total: n,
    order: "smallest first",
    allows: (_c, p) => allows(p),
  });

export const oddCompositions = inSet("OddCompositions", partSets.odd);
export const properCompositions = inSet("ProperCompositions", (p) => ["GreaterEqual", p, 2]);
export const dyadicCompositions = inSet("DyadicCompositions", partSets.powerOfTwo);
export const fibonacciCompositions = inSet("FibonacciCompositions", (p) => ["LessEqual", p, 2]);
export const triCompositions = inSet("TriCompositions", (p) => ["LessEqual", p, 3]);
export const tetraCompositions = inSet("TetraCompositions", (p) => ["LessEqual", p, 4]);
export const triangularCompositions = inSet("TriangularCompositions", partSets.triangular);
export const primeCompositions = inSet("PrimeCompositions", partSets.prime);

/** The walk's family, declining past 2^53: its table is wider than a hundred entries (n at 100,
 *  3n at 34), which the interpreter's exact integers can't finish. Unknown there, as the TS kernels left it. */
const decliningWalk = (spec: PartWalk): EpsilFamily => ({ ...partWalk(spec), declinePastDoubles: "count" });

/** What Plausible reads: counting and indexing run a DP table, polynomial in n and k. */
const boundedDeclared: Declared = {
  carrier: "Composition",
  params: [
    { name: "size", role: "axis", min: 0 },
    { name: "k", role: "param", min: 0 },
  ],
  cost: { count: "polynomial", unrank: "polynomial", rank: "polynomial", valid: "polynomial" },
};

export const partSizeBoundedCompositions: EpsilFamily = partWalk({
  head: "PartSizeBoundedCompositions",
  carrier: "Composition",
  declared: boundedDeclared,
  paramCount: 2,
  params: [n, k],
  total: n,
  order: "smallest first",
  limit: () => k,
});

/** At most k parts: the context is the parts still allowed (n parts at most are ever placed).
 *  The sum over the next part telescopes: S(m, j) = S(m − 1, j) + S(m − 1, j − 1), S(1, j) = 1. */
export const partCountBoundedCompositions: EpsilFamily = decliningWalk({
  head: "PartCountBoundedCompositions",
  carrier: "Composition",
  declared: boundedDeclared,
  paramCount: 2,
  params: [n, k],
  total: n,
  order: "smallest first",
  width: cap,
  start: ["Min", k, n],
  allows: (c) => ["GreaterEqual", c, 1],
  next: (c) => sub(c, 1),
  recurrence: (read, _here, m, c) =>
    iff(equal(c, 0), 0, iff(equal(m, 1), 1, add(read(sub(m, 1), c), read(sub(m, 1), sub(c, 1))))),
});

/** No two equal parts side by side: the context is the part before (0 at the start). Every
 *  context but the start has the start's completions, less those of the part before it again. */
export const carlitzCompositions: EpsilFamily = decliningWalk({
  head: "CarlitzCompositions",
  carrier: "Composition",
  paramCount: 1,
  params: [n],
  total: n,
  order: "smallest first",
  width: cap,
  allows: (c, p) => ["NotEqual", p, c],
  next: (_c, p) => p,
  recurrence: (read, here, m, c) =>
    iff(
      equal(c, 0),
      fold(add("ca_a", read(sub(m, "ca_p"), "ca_p")), "ca_a", "ca_p", 0, upTo(1, m)),
      sub(here(0), iff(["LessEqual", c, m], read(sub(m, c), c), 0)),
    ),
});

// Alternating parts, up-down or down-up. The context is a column of the table, in blocks: 0..n − 1
// "the next must rise" after part n − c; n..2n − 1 "the next must fall" after part c − n + 1;
// 2n..3n − 1 "either" after part c − 2n + 1; 3n before any part. Rise and fall are running sums
// over the part before, taken from the neighbouring column of the same sum, which the order of
// the blocks puts first; "either" is a rise and a fall.
const rise = (p: MathJSON): MathJSON => sub(n, p);
const fall = (p: MathJSON): MathJSON => sub(add(n, p), 1);
const either = (p: MathJSON): MathJSON => sub(add(mul(2, n), p), 1);
const rises = (c: MathJSON): MathJSON => less(c, n);
const falls = (c: MathJSON): MathJSON => and(["GreaterEqual", c, n], less(c, mul(2, n)));
const eithers = (c: MathJSON): MathJSON => and(["GreaterEqual", c, mul(2, n)], less(c, mul(3, n)));
/** The part before: 0 at the start. */
const before = (c: MathJSON): MathJSON =>
  iff(rises(c), sub(n, c), iff(falls(c), add(sub(c, n), 1), iff(eithers(c), add(sub(c, mul(2, n)), 1), 0)));
export const zigzagCompositions: EpsilFamily = decliningWalk({
  head: "ZigzagCompositions",
  carrier: "Composition",
  paramCount: 1,
  params: [n],
  total: n,
  order: "smallest first",
  width: add(mul(3, n), 1),
  start: mul(3, n),
  allows: (c, p) =>
    iff(
      rises(c),
      ["Greater", p, before(c)],
      iff(falls(c), less(p, before(c)), iff(eithers(c), ["NotEqual", p, before(c)], "True")),
    ),
  next: (c, p) =>
    iff(
      rises(c),
      fall(p),
      iff(falls(c), rise(p), iff(eithers(c), iff(["Greater", p, before(c)], fall(p), rise(p)), either(p))),
    ),
  recurrence: (read, here, m, c) => {
    const above = add(sub(n, c), 1); // a rise adds the part above this one's, falling next
    const below = sub(before(c), 1); // a fall adds the part below this one's, rising next
    return iff(
      rises(c),
      iff(equal(c, 0), 0, add(here(sub(c, 1)), iff(["LessEqual", above, m], read(sub(m, above), fall(above)), 0))),
      iff(
        falls(c),
        iff(equal(c, n), 0, add(here(sub(c, 1)), iff(["LessEqual", below, m], read(sub(m, below), rise(below)), 0))),
        iff(
          eithers(c),
          add(here(rise(before(c))), here(fall(before(c)))),
          fold(add("zz_a", read(sub(m, "zz_q"), either("zz_q"))), "zz_a", "zz_q", 0, upTo(1, m)),
        ),
      ),
    );
  },
});

// ─── PalindromicCompositions(n): lex on the parts, the family of the first part a. A palindrome
// of m starts [a, middle, a] with the middle a palindrome of m − 2a (a ≤ ⌊m/2⌋: 2^(⌊m/2⌋ − a) of
// them), or is [m] alone, last. So the count is 2^⌊m/2⌋, and with no table to read, the first
// part is a search over powers of two. The state is [m left, rank left, middle, the left half…];
// the middle is 0 until a lone part ends the walk.
const half = (m: MathJSON): MathJSON => quotient(m, 2);
const pow2 = (e: MathJSON): MathJSON => ["Power", 2, e];
/** The palindromes of m starting with a part below a: 2^h − 2^(h − a + 1). */
const blocksBefore = (h: MathJSON, a: MathJSON): MathJSON => sub(pow2(h), pow2(sub(add(h, 1), a)));
const palindromeStep = lets(
  [
    ["pa_m", at("pa_u", 1), "integer"],
    ["pa_r", at("pa_u", 2), "integer"],
    ["pa_h", half(at("pa_u", 1)), "integer"],
  ],
  iff(
    equal("pa_m", 0),
    "pa_u",
    iff(
      less("pa_r", sub(pow2("pa_h"), 1)),
      // The first part a is the first whose blocks (up to a) pass the rank.
      lets(
        [
          [
            "pa_a",
            fold(iff(less("pa_r", blocksBefore("pa_h", add("pa_j", 1))), "pa_j", "pa_f"), "pa_f", "pa_j", "pa_h", [
              "Range",
              "pa_h",
              1,
              -1,
            ]),
            "integer",
          ],
        ],
        [
          "Join",
          ["List", sub("pa_m", mul(2, "pa_a")), sub("pa_r", blocksBefore("pa_h", "pa_a")), at("pa_u", 3)],
          ["Drop", "pa_u", 3],
          ["List", "pa_a"],
        ],
      ),
      ["Join", ["List", 0, sub("pa_r", sub(pow2("pa_h"), 1)), "pa_m"], ["Drop", "pa_u", 3]],
    ),
  ),
);
const palindromeEnd = lets(
  [["pa_s", fold(palindromeStep, "pa_u", "pa_i", ["List", n, "_r", 0], upTo(1, n)), "list<integer>"]],
  lets(
    [
      ["pa_left", ["Drop", "pa_s", 3], "list<integer>"],
      ["pa_len", ["Length", "pa_left"], "integer"],
    ],
    [
      "Join",
      "pa_left",
      iff(equal(at("pa_s", 3), 0), ["List"], ["List", at("pa_s", 3)]),
      map(at("pa_left", add(sub("pa_len", "pa_j"), 1)), "pa_j", upTo(1, "pa_len")),
    ],
  ),
);
const x = (j: MathJSON): MathJSON => at("_x", j);
const len: MathJSON = ["Length", "_x"];
// The state is [rank so far, sum left, done]. A part a with 2a < m is the first of a block; a part
// equal to m is the lone middle, after every block; the walk is done when nothing is left.
const palindromeRankStep = lets(
  [
    ["pa_r", at("pa_a", 1), "integer"],
    ["pa_m", at("pa_a", 2), "integer"],
    ["pa_h", half(at("pa_a", 2)), "integer"],
  ],
  iff(
    ["Or", equal(at("pa_a", 3), 1), equal("pa_m", 0)],
    "pa_a",
    iff(
      equal(x("pa_j"), "pa_m"),
      ["List", add("pa_r", sub(pow2("pa_h"), 1)), 0, 1],
      ["List", add("pa_r", blocksBefore("pa_h", x("pa_j"))), sub("pa_m", mul(2, x("pa_j"))), 0],
    ),
  ),
);

export const palindromicCompositions: EpsilFamily = {
  head: "PalindromicCompositions",
  carrier: "Composition",
  paramCount: 1,
  kind: "ints",
  params: [n],
  epsil: {
    count: pow2(half(n)),
    unrank: palindromeEnd,
    rank: at(fold(palindromeRankStep, "pa_a", "pa_j", ["List", 0, n, 0], upTo(1, len)), 1),
    // Positive parts adding up to n, the same read from both ends.
    valid: and(
      equal(fold(add("pa_t", "pa_v"), "pa_t", "pa_v", 0, "_x"), n),
      all((j) => ["GreaterEqual", x(j), 1], upTo(1, len), "pa_g"),
      all((j) => equal(x(j), x(add(sub(len, j), 1))), upTo(1, len), "pa_k"),
    ),
  },
};
