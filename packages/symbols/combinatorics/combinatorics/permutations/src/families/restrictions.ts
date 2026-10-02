// Restrictions of the symmetric group by descents, alternation, indecomposability and patterns, in its lex
// order: each is its completion count (`permutationRestriction`, collections/src/families/
// lex-restriction.ts). Over `prefix` (n slots, the first `filled` set) the counts read the
// prefix's last entry, how many free values lie below it (a), and m = n − filled free slots.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import type { Declared } from "../../../collections/src/families/types.ts";
import { permutationRestriction } from "../../../collections/src/families/lex-restriction.ts";
import {
  add,
  and,
  at,
  cell,
  equal,
  fold,
  iff,
  less,
  lets,
  map,
  mul,
  quotient,
  rowTable,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";

type MathJSON = unknown;

const n = "_n";

/** What Plausible reads: every operation is a completion-count table, polynomial in n. */
const polynomial = (withK = false): Declared => ({
  carrier: "Permutation",
  params: [{ name: "size", role: "axis", min: 0 }, ...(withK ? [{ name: "k", role: "param" as const, min: 0 }] : [])],
  cost: { count: "polynomial", unrank: "polynomial", rank: "polynomial", valid: "polynomial" },
});
const pre = (q: MathJSON): MathJSON => at("prefix", q);
const last = pre("filled");
const open = sub(n, "filled");
const sum = (body: (i: string) => MathJSON, i: string, from: MathJSON, to: MathJSON): MathJSON =>
  fold(add(`sum_${i}`, body(i)), `sum_${i}`, i, 0, upTo(from, to));
const count = (condition: (i: string) => MathJSON, i: string, from: MathJSON, to: MathJSON): MathJSON =>
  sum((x) => iff(condition(x), 1, 0), i, from, to);
const used = (v: MathJSON): MathJSON =>
  fold(["Or", "seen", ["Equal", pre("ut"), v]], "seen", "ut", "False", upTo(1, "filled"));
/** Free values below (or above) the prefix's last entry. */
const freeBelow = count((v) => ["And", ["Less", v, last], ["Not", used(v)]], "fb", 1, n);
const freeAbove = count((v) => ["And", ["Greater", v, last], ["Not", used(v)]], "fa", 1, n);
const descents = count((q) => ["Greater", pre(q), pre(add(q, 1))], "pd", 1, sub("filled", 1));
const ascents = count((q) => ["Less", pre(q), pre(add(q, 1))], "pa", 1, sub("filled", 1));

/**
 * At most one descent (Grassmannian), or one ascent with `rises`. With one already in the prefix
 * the rest must run on without another: 1 completion when every free value lies past the last
 * entry, else 0. With none, the free values have a lying on the turning side of the last entry:
 * 2^(m − a) completions when a ≥ 1, the whole 2^m − m when a = 0.
 */
function atMostOneTurn(head: string, rises: boolean): EpsilFamily {
  const [turns, behind] = rises ? [ascents, freeAbove] : [descents, freeBelow];
  return permutationRestriction({
    head,
    carrier: "Permutation",
    paramCount: 1,
    params: [n],
    declared: polynomial(),
    completions: lets(
      [
        ["turns", iff(["Equal", "filled", 0], 0, turns), "integer"],
        ["behind", iff(["Equal", "filled", 0], 0, behind), "integer"],
      ],
      iff(
        ["Greater", "turns", 1],
        0,
        iff(
          ["Equal", "turns", 1],
          iff(["Equal", "behind", 0], 1, 0),
          iff(["GreaterEqual", "behind", 1], ["Power", 2, sub(open, "behind")], sub(["Power", 2, open], open)),
        ),
      ),
    ),
  });
}

// Alternating (up-down: p1 < p2 > p3 < …). D(m, i) and U(m, i) count the down-up and up-down
// arrangements of m values starting with the i-th smallest (Entringer numbers): D(m, i) sums
// U(m − 1, ·) over the ranks below i, U(m, i) sums D(m − 1, ·) over the ranks from i. One table,
// row s for m = s + 1, columns 1..n for D and n + 2..2n + 1 for U.
const altWidth = mul(2, add(n, 1));
const altCell = cell("entringer", altWidth);
const downUp = (m: MathJSON, i: MathJSON): MathJSON => altCell(sub(m, 1), i);
const upDown = (m: MathJSON, i: MathJSON): MathJSON => altCell(sub(m, 1), add(n, 1, i));
const entringer = rowTable(
  "en",
  ["Max", n, 1],
  altWidth,
  (c) => iff(["Or", ["Equal", c, 1], ["Equal", c, add(n, 2)]], 1, 0),
  (prev, s, c) =>
    iff(
      ["LessEqual", c, n],
      sum((i) => prev(sub(s, 1), add(n, 1, i)), "ed", 1, sub(c, 1)),
      sum((i) => prev(sub(s, 1), i), "eu", sub(c, add(n, 1)), s),
    ),
);

/** The up-down permutations of n. After a prefix that alternates so far, the free values continue
 *  down-up from above the last entry (odd length) or up-down from below it (even length). */
const alternatingPermutations: EpsilFamily = permutationRestriction({
  head: "AlternatingPermutations",
  carrier: "Permutation",
  paramCount: 1,
  params: [n],
  declared: polynomial(),
  tables: [["entringer", entringer]],
  completions: iff(
    fold(
      [
        "And",
        "zig",
        iff(
          ["Equal", ["Mod", "za", 2], 1],
          ["Less", pre("za"), pre(add("za", 1))],
          ["Greater", pre("za"), pre(add("za", 1))],
        ),
      ],
      "zig",
      "za",
      "True",
      upTo(1, sub("filled", 1)),
    ),
    iff(
      ["Equal", open, 0],
      1,
      iff(
        ["Equal", "filled", 0],
        sum((i) => upDown(n, i), "az", 1, n),
        lets(
          [["below", freeBelow, "integer"]],
          iff(
            ["Equal", ["Mod", "filled", 2], 1],
            sum((i) => downUp(open, i), "ao", add("below", 1), open),
            sum((i) => upDown(open, i), "ae", 1, "below"),
          ),
        ),
      ),
    ),
    0,
  ),
});

/**
 * Indecomposable (no proper prefix of values {1..k}). A prefix with such a cut has none. After
 * it, a cut at k ≥ max(prefix) means the first k − filled free slots take the smallest free
 * values; with t₀ the first slot count that can cut, h(t) counts arrangements of t values with
 * no cut at t₀..t − 1, and the completions are m! less those whose first cut is at some t.
 */
const connectedPermutations: EpsilFamily = permutationRestriction({
  head: "ConnectedPermutations",
  carrier: "Permutation",
  paramCount: 1,
  params: [n],
  declared: polynomial(),
  completions: iff(
    fold(
      ["Or", "cut", ["Equal", fold(["Max", "mx", pre("cq")], "mx", "cq", 0, upTo(1, "ck")), "ck"]],
      "cut",
      "ck",
      "False",
      upTo(1, ["Min", "filled", sub(n, 1)]),
    ),
    0,
    lets(
      [
        [
          "first",
          ["Max", 1, sub(fold(["Max", "mx2", pre("cm")], "mx2", "cm", 0, upTo(1, "filled")), "filled")],
          "integer",
        ],
        [
          "h",
          fold(
            [
              "Append",
              "hs",
              sub(
                ["Factorial", "ht"],
                sum((u) => mul(at("hs", add(u, 1)), ["Factorial", sub("ht", u)]), "hu", "first", sub("ht", 1)),
              ),
            ],
            "hs",
            "ht",
            ["List"],
            upTo(0, sub(open, 1)),
          ),
          "list<integer>",
        ],
      ],
      sub(
        ["Factorial", open],
        sum((t) => mul(at("h", add(t, 1)), ["Factorial", sub(open, t)]), "hg", "first", sub(open, 1)),
      ),
    ),
  ),
});

// Exactly k descents. E(m, t, i) counts the arrangements of m values starting with the i-th
// smallest that have t descents: the next value either lies below (a descent, from
// E(m − 1, t − 1, ·) over the ranks below i) or above (E(m − 1, t, ·) over the ranks from i).
// Row s for m = s + 1, column t (n + 1) + i.
const descentWidth = mul(add(n, 1), add(n, 1));
const descentCell = cell("eulerian", descentWidth);
const byFirst = (m: MathJSON, t: MathJSON, i: MathJSON): MathJSON =>
  iff(["Or", ["Less", t, 0], ["Greater", t, n]], 0, descentCell(sub(m, 1), add(mul(t, add(n, 1)), i)));
const eulerianByFirst = rowTable(
  "eu",
  ["Max", n, 1],
  descentWidth,
  (c) => iff(["Equal", c, 1], 1, 0),
  (prev, s, c) =>
    lets(
      [
        ["et", quotient(c, add(n, 1)), "integer"],
        ["ei", ["Mod", c, add(n, 1)], "integer"],
      ],
      iff(
        ["Or", ["Equal", "ei", 0], ["Greater", "ei", add(s, 1)]],
        0,
        add(
          iff(
            ["Equal", "et", 0],
            0,
            sum((i) => prev(sub(s, 1), add(mul(sub("et", 1), add(n, 1)), i)), "eb", 1, sub("ei", 1)),
          ),
          sum((i) => prev(sub(s, 1), add(mul("et", add(n, 1)), i)), "ea", "ei", s),
        ),
      ),
    ),
);

/** The permutations of n with exactly k descents (Eulerian numbers). The free values must add
 *  the descents still missing, counting one more at the join when they start below the last entry. */
const kDescentPermutations: EpsilFamily = permutationRestriction({
  head: "KDescentPermutations",
  carrier: "Permutation",
  paramCount: 2,
  params: [n, "_k"],
  declared: polynomial(true),
  tables: [["eulerian", eulerianByFirst]],
  completions: lets(
    [["need", sub("_k", iff(["Equal", "filled", 0], 0, descents)), "integer"]],
    iff(
      ["Equal", open, 0],
      iff(["Equal", "need", 0], 1, 0),
      iff(
        ["Equal", "filled", 0],
        sum((i) => byFirst(open, "need", i), "kz", 1, open),
        lets(
          [["below", freeBelow, "integer"]],
          sum((i) => byFirst(open, iff(["LessEqual", i, "below"], sub("need", 1), "need"), i), "ks", 1, open),
        ),
      ),
    ),
  ),
});

// Avoiding a pattern of length 3. Every prefix the operations ask about extends one that has
// completions, so it avoids the pattern itself; what's left is how the free values may follow it.
// An occurrence with two entries in the prefix rules out free values in some range (none may be
// left); one with a single entry constrains the free values relative to it. Over the free values'
// running count `fr` (fr[v + 1] free values up to v), `between(lo, hi)` counts those strictly
// between. The constrained values are the top or bottom k free ones (123, 132, 321, 312), leaving
// the ballot number (k + 1)/(m + 1)·C(2m − k, m); or, for 231 and 213, the free values must come
// run by run (a run lies between consecutive prefix values), each run avoiding it alone: a product
// of Catalan numbers.
const between = (lo: MathJSON, hi: MathJSON): MathJSON => sub(at("fr", hi), at("fr", add(lo, 1)));
const catalan = (r: MathJSON): MathJSON => quotient(["Binomial", mul(2, r), r], add(r, 1));
const ballot = (m: MathJSON, k: MathJSON): MathJSON =>
  quotient(mul(add(k, 1), ["Binomial", sub(mul(2, m), k), m]), add(m, 1));
const prefixMin = fold(["Min", "pmn", pre("pmi")], "pmn", "pmi", add(n, 1), upTo(1, "filled"));
const prefixMax = fold(["Max", "pmx", pre("pmj")], "pmx", "pmj", 0, upTo(1, "filled"));
/** Catalan(run) over the runs of free values, in value order. */
const runs = lets(
  [
    [
      "rs",
      fold(
        iff(
          equal(at("fr", add("rv", 1)), at("fr", "rv")),
          ["List", mul(at("rq", 1), catalan(at("rq", 2))), 0],
          ["List", at("rq", 1), add(at("rq", 2), 1)],
        ),
        "rq",
        "rv",
        ["List", 1, 0],
        upTo(1, n),
      ),
      "list<integer>",
    ],
  ],
  mul(at("rs", 1), catalan(at("rs", 2))),
);

/** A pattern's two-entry rule: given prefix entries a before b, whether a free value it forbids is left. */
type Forbids = (a: MathJSON, b: MathJSON) => MathJSON;
const PATTERN_RULES: Record<string, { forbids: Forbids; rest: MathJSON }> = {
  "123": { forbids: (a, b) => and(less(a, b), ["Greater", between(b, add(n, 1)), 0]), rest: "top" },
  "132": { forbids: (a, b) => and(less(a, b), ["Greater", between(a, b), 0]), rest: "top" },
  "321": { forbids: (a, b) => and(less(b, a), ["Greater", between(0, b), 0]), rest: "bottom" },
  "312": { forbids: (a, b) => and(less(b, a), ["Greater", between(b, a), 0]), rest: "bottom" },
  "231": { forbids: (a, b) => and(less(a, b), ["Greater", between(0, a), 0]), rest: "runs" },
  "213": { forbids: (a, b) => and(less(b, a), ["Greater", between(a, add(n, 1)), 0]), rest: "runs" },
};

function permutationsAvoiding(pattern: string): EpsilFamily {
  const { forbids, rest } = PATTERN_RULES[pattern];
  const forbidden = fold(
    ["Or", "pf", fold(["Or", "pg", forbids(pre("pi"), pre("pj"))], "pg", "pi", "False", upTo(1, sub("pj", 1)))],
    "pf",
    "pj",
    "False",
    upTo(1, "filled"),
  );
  const k =
    rest === "top"
      ? iff(equal("filled", 0), 0, sub(open, at("fr", add(prefixMin, 1))))
      : iff(equal("filled", 0), 0, at("fr", prefixMax));
  const [p1, p2, p3] = pattern.split("").map(Number);
  const x = (q: string): MathJSON => at("_x", q);
  const order = (u: number, v: number, a: string, b: string): MathJSON => (u < v ? less(x(a), x(b)) : less(x(b), x(a)));
  const occurs = fold(
    [
      "Or",
      "po",
      fold(
        [
          "Or",
          "pp",
          fold(
            ["Or", "pq", and(order(p1, p2, "oi", "oj"), order(p2, p3, "oj", "ok"), order(p1, p3, "oi", "ok"))],
            "pq",
            "oi",
            "False",
            upTo(1, sub("oj", 1)),
          ),
        ],
        "pp",
        "oj",
        "False",
        upTo(1, sub("ok", 1)),
      ),
    ],
    "po",
    "ok",
    "False",
    upTo(1, n),
  );
  return permutationRestriction({
    head: `PermutationsAvoiding${pattern}`,
    carrier: "Permutation",
    paramCount: 1,
    params: [n],
    declared: polynomial(),
    predicate: ["Not", occurs],
    completions: lets(
      [
        [
          "fr",
          fold(
            ["ReplaceAt", "fs", add("fv", 1), add(at("fs", "fv"), iff(used("fv"), 0, 1))],
            "fs",
            "fv",
            map(0, "fz", upTo(0, n)),
            upTo(1, n),
          ),
          "list<integer>",
        ],
      ],
      iff(forbidden, 0, rest === "runs" ? runs : ballot(open, k)),
    ),
  });
}

export const permutationsAvoiding3 = ["123", "132", "213", "231", "312", "321"].map(permutationsAvoiding);

export const grassmannianPermutations = atMostOneTurn("GrassmannianPermutations", false);
export const cograssmannianPermutations = atMostOneTurn("CograssmannianPermutations", true);
export { alternatingPermutations, connectedPermutations, kDescentPermutations };
