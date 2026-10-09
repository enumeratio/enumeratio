// Restrictions of the symmetric group by descents, alternation, indecomposability and patterns, in its lex
// order: each is its completion count (`permutationRestriction`, collections/src/families/
// lex-restriction.ts). Over `prefix` (n slots, the first `filled` set) the counts read the
// prefix's last entry, how many free values lie below it (a), and m = n − filled free slots;
// `taken` says in O(1) whether a value is used.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import type { Declared } from "../../../collections/src/families/types.ts";
import { permutationRestriction } from "../../../collections/src/families/lex-restriction.ts";
import {
  add,
  all,
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
const used = (v: MathJSON): MathJSON => ["NotEqual", at("taken", v), 0];
/** The list of `body` over `variable` = from..to, filled in place: the interpreter keeps a `Map`
 *  lazy, so a mapped list read by `At` many times is recomputed each time. */
const tabulate = (body: MathJSON, variable: string, from: MathJSON, to: MathJSON): MathJSON =>
  fold(
    ["ReplaceAt", `${variable}_l`, add(sub(variable, from), 1), body],
    `${variable}_l`,
    variable,
    map(0, `${variable}_z`, upTo(from, to)),
    upTo(from, to),
  );
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
    taken: true,
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
  tables: ["entringer", entringer],
  taken: true,
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
  tables: ["eulerian", eulerianByFirst],
  taken: true,
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

// Exactly k inversions. A prefix's inversions are its Lehmer digits (the free values below each
// entry), and the m values left take M(m, c) arrangements with c inversions, the Mahonian
// numbers: M(m, c) = Σ_{d < m} M(m − 1, c − d). Only columns 0..k are read, so the table stops
// there. The prefix state is [inversions so far, then per value 1 while it is free].
const inversionWidth = add(["Min", "_k", quotient(mul(n, sub(n, 1)), 2)], 1);
const mahonian = cell("mahonian", inversionWidth);
const mahonianTable = rowTable(
  "mh",
  add(n, 1),
  inversionWidth,
  (c) => iff(equal(c, 0), 1, 0),
  (prev, s, c) => sum((d) => prev(sub(s, 1), sub(c, d)), "mh_d", 0, ["Min", c, sub(s, 1)]),
);

/** The permutations of n with exactly k inversions (Mahonian numbers), in lex order. */
export const kInversionPermutations: EpsilFamily = permutationRestriction({
  head: "KInversionPermutations",
  carrier: "Permutation",
  paramCount: 2,
  params: [n, "_k"],
  tables: ["mahonian", mahonianTable],
  state: {
    init: ["Join", ["List", 0], map(1, "ki_z", upTo(1, n))],
    step: lets(
      [["ki_below", sum((u) => at("pstate", add(u, 1)), "ki_u", 1, sub("value", 1)), "integer"]],
      ["ReplaceAt", ["ReplaceAt", "pstate", 1, add(at("pstate", 1), "ki_below")], add("value", 1), 0],
    ),
  },
  completions: lets(
    [["ki_left", sub("_k", at("pstate", 1)), "integer"]],
    iff(["Or", less("ki_left", 0), ["GreaterEqual", "ki_left", inversionWidth]], 0, mahonian(open, "ki_left")),
  ),
});

// Permutations whose every inversion is of adjacent entries: the identity with some disjoint
// adjacent pairs swapped. S(r) of them on r slots, 1, 1, 2, 3, 5, …, one table. At slot j, a
// pair is open when the entry before it is j (it started a swap with j − 1 still to come); the
// next entry is then j − 1 (closing it), else j (no swap) or j + 1 (opening one, which forces
// slot j + 1).
const swapsTable = fold(
  ["Join", "sw_t", ["List", add(at("sw_t", "sw_k"), at("sw_t", sub("sw_k", 1)))]],
  "sw_t",
  "sw_k",
  ["List", 1, 1],
  upTo(2, n),
);
const swaps = (slots: MathJSON): MathJSON => at("swaps", add(slots, 1));
const adjacentTranspositionInvolutions: EpsilFamily = permutationRestriction({
  head: "AdjacentTranspositionInvolutions",
  carrier: "Permutation",
  paramCount: 1,
  params: [n],
  tables: ["swaps", swapsTable],
  // Each entry stays put or swaps with its neighbour; completions only checks the entry just placed.
  predicate: all(
    (j) =>
      iff(
        equal(at("_x", j), j),
        "True",
        iff(
          equal(at("_x", j), add(j, 1)),
          equal(at("_x", add(j, 1)), j),
          iff(equal(at("_x", j), sub(j, 1)), equal(at("_x", sub(j, 1)), j), "False"),
        ),
      ),
    upTo(1, n),
    "sw_j",
  ),
  completions: iff(
    equal("filled", 0),
    swaps(n),
    iff(
      iff(["Greater", "filled", 1], equal(pre(sub("filled", 1)), "filled"), "False"),
      iff(equal(last, sub("filled", 1)), swaps(open), 0),
      iff(equal(last, "filled"), swaps(open), iff(equal(last, add("filled", 1)), swaps(sub(open, 1)), 0)),
    ),
  ),
});

const catalan = (r: MathJSON): MathJSON => quotient(["Binomial", mul(2, r), r], add(r, 1));

// The permutations below the long cycle: cycles that rise (each member goes to the next greater
// one, the greatest to the least) with supports that don't cross. Left to right, an entry above
// its slot is the next member of a cycle and reserves that position (a pending target);
// non-crossing makes the pending targets nest, so the entry at a slot j is
//   - j itself (no cycle), or above j and below every pending target (a new cycle), or
//   - at a pending target (the least), the least member of its cycle, which is the greatest
//     value below j still free, or above j and below the other pending targets.
// The positions between j and the least pending target form a non-crossing permutation of their
// own, as does each stretch from one pending target up to the next: Catalan(distance) of each.
// `held(w)` is the slot that holds value w, 0 if free.
const ncTransition = (j: MathJSON, v: MathJSON, held: (w: MathJSON) => MathJSON): MathJSON =>
  lets(
    [["nc_wt", iff(and(["Greater", held(j), 0], less(held(j), j)), 1, 0), "integer"]],
    [
      "Or",
      and(
        ["Greater", v, j],
        [
          "Not",
          fold(
            ["Or", "nc_b", and(["Greater", held("nc_w"), 0], less(held("nc_w"), j))],
            "nc_b",
            "nc_w",
            "False",
            upTo(add(j, 1), sub(v, 1)),
          ),
        ],
      ),
      and(
        equal("nc_wt", 1),
        less(v, j),
        all((u) => ["NotEqual", held(u), 0], upTo(add(v, 1), sub(j, 1)), "nc_u"),
      ),
      and(equal("nc_wt", 0), equal(v, j)),
    ],
  );
/** The completions after slot j: Catalan of the distance between pending targets, from j + 1 on. */
const ncCompletions = (j: MathJSON, held: (w: MathJSON) => MathJSON): MathJSON =>
  lets(
    [
      [
        "nc_s",
        fold(
          iff(
            and(["GreaterEqual", held("nc_t"), 1], ["LessEqual", held("nc_t"), j]),
            ["List", mul(at("nc_a", 1), catalan(sub("nc_t", at("nc_a", 2)))), "nc_t"],
            "nc_a",
          ),
          "nc_a",
          "nc_t",
          ["List", 1, add(j, 1)],
          upTo(add(j, 1), n),
        ),
        "list<integer>",
      ],
    ],
    mul(at("nc_s", 1), catalan(sub(add(n, 1), at("nc_s", 2)))),
  );
const nonCrossingPermutations: EpsilFamily = permutationRestriction({
  head: "NonCrossingPermutations",
  carrier: "Permutation",
  paramCount: 1,
  params: [n],
  declared: polynomial(),
  taken: true,
  completions: iff(
    equal("filled", 0),
    catalan(n),
    iff(
      ncTransition("filled", last, (w) => at("taken", w)),
      ncCompletions("filled", (w) => at("taken", w)),
      0,
    ),
  ),
  // Completions only checks the entry just placed, so replay every slot against the slots up to it.
  predicate: lets(
    [
      [
        "nc_where",
        fold(["ReplaceAt", "nc_at", at("_x", "nc_p"), "nc_p"], "nc_at", "nc_p", map(0, "nc_z", upTo(1, n)), upTo(1, n)),
        "list<integer>",
      ],
    ],
    all(
      (j) => ncTransition(j, at("_x", j), (w) => iff(["LessEqual", at("nc_where", w), j], at("nc_where", w), 0)),
      upTo(1, n),
      "nc_j",
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
    taken: true,
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

// Separable: Av(2413, 3142), built from 1 by direct (⊕) and skew (⊖) sums, counted by the large
// Schröder numbers. Completions follow the decomposition over a window of values [lo, lo + s − 1]
// and the prefix entries still to place, from slot j + 1 on: K(j, lo, s) counts the separable
// arrangements of the window starting with them, K⊕ and K⊖ those that are a ⊕ (or ⊖) sum. In a
// ⊕ sum the first component takes the lowest values. When the remaining prefix opens with a run
// on exactly the lowest c₀ values, that run is the first component (c₀ is the shortest such run,
// so the run is ⊕-indecomposable) and the rest is K of the window above it. Otherwise the first
// component takes the whole remaining prefix and some c values, a ⊖ sum, times the separable
// arrangements of the s − c values left. ⊖ is the mirror image. With no prefix left, a window of
// s ≥ 2 values is ⊕ or ⊖ in half its sep(s) arrangements each. Any pattern inside a run is one
// the prefix already avoids, since every occurrence in it ends at its last entry.
const sep = (size: MathJSON): MathJSON => iff(equal(size, 0), 1, at("schroder", size));
/** S(0..n − 1) by S(k) = ((6k − 3) S(k − 1) − (k − 2) S(k − 2)) / (k + 1), from S(0) = 1, S(1) = 2. */
const schroderTable = fold(
  [
    "Append",
    "sq",
    quotient(sub(mul(sub(mul(6, "sk"), 3), at("sq", "sk")), mul(sub("sk", 2), at("sq", sub("sk", 1)))), add("sk", 1)),
  ],
  "sq",
  "sk",
  ["List", 1, 2],
  upTo(2, sub(n, 1)),
);
/** A cell's column: start j (0 ≤ j < filled), window bottom lo, and ⊕ (1) or ⊖ (2). */
const sepColumn = (j: MathJSON, lo: MathJSON, kind: MathJSON): MathJSON =>
  add(mul(2, add(mul(add(n, 1), j), sub(lo, 1))), sub(kind, 1));
/** Whether the prefix from slot j + 1 fits a window of s values from lo. */
const sepFits = (j: MathJSON, lo: MathJSON, s: MathJSON): MathJSON =>
  and(
    less(j, "filled"),
    ["LessEqual", sub("filled", j), s],
    ["LessEqual", add(lo, s, -1), n],
    ["GreaterEqual", at("smin", add(j, 1)), lo],
    ["LessEqual", at("smax", add(j, 1)), add(lo, s, -1)],
  );
type Read = (s: MathJSON, column: MathJSON) => MathJSON;
const sepAll = (read: Read, j: MathJSON, lo: MathJSON, s: MathJSON): MathJSON =>
  iff(
    equal(j, "filled"),
    sep(s),
    iff(sepFits(j, lo, s), add(iff(equal(s, 1), 1, 0), read(s, sepColumn(j, lo, 1)), read(s, sepColumn(j, lo, 2))), 0),
  );
/** K⊕ (or K⊖) at (j, lo, s), reading smaller windows. */
function sepSum(read: Read, plus: boolean, j: string, lo: string, s: string): MathJSON {
  const hi = add(lo, s, -1);
  const rem = sub("filled", j);
  const run = fold(
    iff(
      ["NotEqual", at("sr", 1), 0],
      "sr",
      lets(
        [
          ["srm", ["Min", at("sr", 2), pre(add(j, "sc"))], "integer"],
          ["srx", ["Max", at("sr", 3), pre(add(j, "sc"))], "integer"],
        ],
        [
          "List",
          iff(
            plus
              ? and(equal("srm", lo), equal("srx", add(lo, "sc", -1)))
              : and(equal("srx", hi), equal("srm", sub(add(hi, 1), "sc"))),
            "sc",
            0,
          ),
          "srm",
          "srx",
        ],
      ),
    ),
    "sr",
    "sc",
    ["List", 0, add(n, 1), 0],
    upTo(1, rem),
  );
  return lets(
    [["sc0", at(run, 1), "integer"]],
    iff(
      ["Greater", "sc0", 0],
      iff(less("sc0", s), sepAll(read, add(j, "sc0"), plus ? add(lo, "sc0") : lo, sub(s, "sc0")), 0),
      sum(
        (c) => mul(read(c, sepColumn(j, plus ? lo : sub(add(hi, 1), c), plus ? 2 : 1)), sep(sub(s, c))),
        "ss",
        add(rem, 1),
        sub(s, 1),
      ),
    ),
  );
}
const sepWidth = mul(2, "filled", add(n, 1));
const sepTable = rowTable(
  "st",
  add(n, 1),
  "sw",
  () => 0,
  (prev, s, c) =>
    lets(
      [
        ["stq", quotient(c, 2), "integer"],
        ["stj", quotient("stq", add(n, 1)), "integer"],
        ["stl", add(["Mod", "stq", add(n, 1)], 1), "integer"],
      ],
      iff(
        sepFits("stj", "stl", s),
        iff(equal(["Mod", c, 2], 0), sepSum(prev, true, "stj", "stl", s), sepSum(prev, false, "stj", "stl", s)),
        0,
      ),
    ),
);
/** Whether entries at a < b < c < d read as 2413 or 3142. */
const separates = (w: MathJSON, x: MathJSON, y: MathJSON, z: MathJSON): MathJSON => [
  "Or",
  and(less(y, w), less(w, z), less(z, x)),
  and(less(x, z), less(z, w), less(w, y)),
];
/** Whether some a < b < c < d (d given) in `list` read as 2413 or 3142. */
const separatesBefore = (list: string, d: MathJSON, tag: string): MathJSON =>
  fold(
    [
      "Or",
      `${tag}c_`,
      fold(
        [
          "Or",
          `${tag}b_`,
          fold(
            ["Or", `${tag}a_`, separates(at(list, `${tag}a`), at(list, `${tag}b`), at(list, `${tag}c`), at(list, d))],
            `${tag}a_`,
            `${tag}a`,
            "False",
            upTo(1, sub(`${tag}b`, 1)),
          ),
        ],
        `${tag}b_`,
        `${tag}b`,
        "False",
        upTo(1, sub(`${tag}c`, 1)),
      ),
    ],
    `${tag}c_`,
    `${tag}c`,
    "False",
    upTo(1, sub(d, 1)),
  );
/** Suffix extremes of the prefix: entry j + 1 the min (or max) over slots j + 1..filled. */
const suffixOf = (op: string, tag: string): MathJSON =>
  tabulate(
    fold(
      [op, `${tag}e`, pre(`${tag}q`)],
      `${tag}e`,
      `${tag}q`,
      op === "Min" ? add(n, 1) : 0,
      upTo(`${tag}j`, "filled"),
    ),
    `${tag}j`,
    1,
    ["Max", "filled", 1],
  );

const separablePermutations: EpsilFamily = permutationRestriction({
  head: "SeparablePermutations",
  carrier: "Permutation",
  paramCount: 1,
  params: [n],
  declared: polynomial(),
  tables: ["schroder", schroderTable],
  predicate: ["Not", fold(["Or", "sd_", separatesBefore("_x", "sd", "sx")], "sd_", "sd", "False", upTo(1, n))],
  completions: iff(
    equal("filled", 0),
    sep(n),
    iff(
      separatesBefore("prefix", "filled", "sp"),
      0,
      lets(
        [
          ["smin", suffixOf("Min", "sn"), "list<integer>"],
          ["smax", suffixOf("Max", "sm"), "list<integer>"],
          ["sw", sepWidth, "integer"],
          ["stable", sepTable, "list<integer>"],
        ],
        sepAll((s, column) => at("stable", add(mul(s, "sw"), column, 1)), 0, 1, n),
      ),
    ),
  ),
});

// Non-crossing: the cycles, read as blocks of a set partition, don't cross. The prefix's edges
// i → prefix(i) split 1..n into components: closed cycles, and paths (an untouched value is one)
// each ending at a value past `filled`. A completion is a non-crossing partition whose blocks are
// unions of components, a block of M paths closing into (M − 1)! cycles, a closed cycle a block on
// its own. A range [i, j] is closed when no component leaves it; F(i, j) counts its completions,
// split on the block B of i (its least value): each gap between B's values, and the range past
// its greatest, must be closed and counted by F, which makes B a union of components and keeps it
// from crossing. B is i's cycle where i is a cycle's least value; otherwise D(v, M) chains B's
// values up to v, M the paths among them (one per path, at its least value).
const ncCode = (a: MathJSON): MathJSON => at("ncc", a);
const ncCycle = (a: MathJSON): MathJSON => equal(["Mod", ncCode(a), 2], 1);
const ncLow = (a: MathJSON): MathJSON => at("nclo", a);
const ncHigh = (a: MathJSON): MathJSON => at("nchi", a);
/** F at [a, b]: 1 when empty, 0 unless closed. Rows of `ncf` run i = n down to 1. */
const ncGet = (a: MathJSON, b: MathJSON): MathJSON =>
  iff(
    ["Greater", a, b],
    1,
    iff(equal(at("ncl", add(mul(sub(a, 1), n), b)), 1), at("ncf", add(mul(sub(n, a), n), b)), 0),
  );
/** Each value's component, walking forward until a value past `filled` ends its path or the walk
 *  returns: twice the path's end, or twice the cycle's least value plus 1. */
const ncCodes = tabulate(
  lets(
    [
      [
        "ncw",
        fold(
          iff(
            ["NotEqual", at("ncs", 2), 0],
            "ncs",
            iff(
              ["Greater", at("ncs", 1), "filled"],
              ["List", at("ncs", 1), 1, at("ncs", 3)],
              lets(
                // `ncq` is typed so the lookup's index doesn't depend on the accumulator's own type
                // (compute-engine 0.150+ then can't prove `ncs` isn't text and won't compile).
                [
                  ["ncq", at("ncs", 1), "integer"],
                  ["ncy", pre("ncq"), "integer"],
                ],
                iff(
                  equal("ncy", "nca"),
                  ["List", at("ncs", 1), 2, at("ncs", 3)],
                  ["List", "ncy", 0, ["Min", at("ncs", 3), "ncy"]],
                ),
              ),
            ),
          ),
          "ncs",
          "nck",
          ["List", "nca", 0, "nca"],
          upTo(1, n),
        ),
        "list<integer>",
      ],
    ],
    iff(equal(at("ncw", 2), 2), add(mul(2, at("ncw", 3)), 1), mul(2, at("ncw", 1))),
  ),
  "nca",
  1,
  n,
);
const ncExtreme = (op: string, tag: string): MathJSON =>
  tabulate(
    fold(
      [op, `${tag}e`, iff(equal(ncCode(`${tag}b`), ncCode(`${tag}a`)), `${tag}b`, op === "Min" ? add(n, 1) : 0)],
      `${tag}e`,
      `${tag}b`,
      op === "Min" ? add(n, 1) : 0,
      upTo(1, n),
    ),
    `${tag}a`,
    1,
    n,
  );
/** 1 where [a, b] is closed, flat by (a − 1) n + b; 1 when a > b. */
const ncClosed = tabulate(
  lets(
    [
      ["nqa", add(quotient("nqi", n), 1), "integer"],
      ["nqb", add(["Mod", "nqi", n], 1), "integer"],
    ],
    iff(
      ["Greater", "nqa", "nqb"],
      1,
      iff(
        fold(
          and("nqok", ["GreaterEqual", ncLow("nqx"), "nqa"], ["LessEqual", ncHigh("nqx"), "nqb"]),
          "nqok",
          "nqx",
          "True",
          upTo("nqa", "nqb"),
        ),
        1,
        0,
      ),
    ),
  ),
  "nqi",
  0,
  sub(mul(n, n), 1),
);
/** D for blocks from i: row t for v = i + t, column M. */
const ncChains = (i: MathJSON): MathJSON =>
  rowTable(
    "nd",
    add(sub(n, i), 1),
    add(n, 1),
    (c) => iff(and(equal(c, 1), ["Not", ncCycle(i)]), 1, 0),
    (prev, t, c) =>
      lets(
        [
          ["ndv", add(i, t), "integer"],
          ["ndm", sub(c, iff(equal(ncLow("ndv"), "ndv"), 1, 0)), "integer"],
        ],
        iff(
          ["Or", ncCycle("ndv"), less("ndm", 0)],
          0,
          sum((u) => mul(prev(u, "ndm"), ncGet(add(i, u, 1), sub("ndv", 1))), "ndu", 0, sub(t, 1)),
        ),
      ),
  );
/** F(i, j) for a cycle's least value i: its gaps, then the range past it. */
const ncCycleBlock = (i: MathJSON, j: MathJSON): MathJSON =>
  lets(
    [
      [
        "ncg",
        fold(
          iff(
            equal(ncCode("ncx"), ncCode(i)),
            ["List", mul(at("ncg_", 1), ncGet(add(at("ncg_", 2), 1), sub("ncx", 1))), "ncx"],
            "ncg_",
          ),
          "ncg_",
          "ncx",
          ["List", 1, i],
          upTo(add(i, 1), ncHigh(i)),
        ),
        "list<integer>",
      ],
    ],
    mul(at("ncg", 1), ncGet(add(ncHigh(i), 1), j)),
  );
const ncRows = fold(
  lets(
    [
      ["nci", sub(n, "nck2"), "integer"],
      ["ncd", ncChains("nci"), "list<integer>"],
    ],
    [
      "Join",
      "ncf",
      tabulate(
        iff(
          ["Or", less("ncj", "nci"), equal(at("ncl", add(mul(sub("nci", 1), n), "ncj")), 0)],
          0,
          iff(
            ncCycle("nci"),
            ncCycleBlock("nci", "ncj"),
            sum(
              (t) =>
                mul(
                  ncGet(add("nci", t, 1), "ncj"),
                  sum((m) => mul(at("ncd", add(mul(t, add(n, 1)), m, 1)), ["Factorial", sub(m, 1)]), "ncm", 1, n),
                ),
              "nct",
              0,
              sub("ncj", "nci"),
            ),
          ),
        ),
        "ncj",
        1,
        n,
      ),
    ],
  ),
  "ncf",
  "nck2",
  ["List"],
  upTo(0, sub(n, 1)),
);

const nonCrossingCycleSupportPermutations: EpsilFamily = permutationRestriction({
  head: "NonCrossingCycleSupportPermutations",
  carrier: "Permutation",
  paramCount: 1,
  params: [n],
  declared: polynomial(),
  completions: iff(
    equal(n, 0),
    1,
    lets(
      [
        ["ncc", ncCodes, "list<integer>"],
        ["nclo", ncExtreme("Min", "nl"), "list<integer>"],
        ["nchi", ncExtreme("Max", "nh"), "list<integer>"],
        ["ncl", ncClosed, "list<integer>"],
        ["ncf", ncRows, "list<integer>"],
      ],
      ncGet(1, n),
    ),
  ),
});

// Vexillary: Av(2143). Over the m free values' ranks, a prefix leaves two kinds of constraint:
// past a prefix inversion b > a, the free ranks above b's (t, the least such) must come
// increasing; and a prefix value between free ranks s and s + 1 (a cut, s < t) makes the ranks
// above s increase once a rank ≤ s has appeared. A prefix 2-1-4 with a free value between its 2
// and 4 has none. V(m, t, S), S the set of cuts, is the same for every prefix that leaves it, so
// it is tabulated once per n over every state: the next value is rank t + 1 (the state stays,
// one rank fewer) or a rank x ≤ t, which sets t below the least cut ≥ x and adds the cut x − 1.
// Block m holds 2^m states: t = 0 first, then each t ≥ 1 with its 2^(t − 1) sets of cuts in
// 1..t − 1, S read as a binary number. The table has 2^(n + 1) − 1 entries, so this is
// exponential in n, if far short of n!.
const vexIndex = (m: MathJSON, t: MathJSON, cuts: MathJSON): MathJSON =>
  add(sub(["Power", 2, m], 1), iff(equal(t, 0), 0, add(["Power", 2, sub(t, 1)], quotient(cuts, 2))), 1);
const bit = (set: MathJSON, b: MathJSON): MathJSON => equal(["Mod", quotient(set, ["Power", 2, b]), 2], 1);
/** V(m, t, S) from the smaller blocks already in `vt`. */
const vexEntry = lets(
  [
    ["vm", "vb", "integer"],
    [
      "vt0",
      fold(iff(["LessEqual", ["Power", 2, sub("vk", 1)], "ve"], "vk", "vtk"), "vtk", "vk", 0, upTo(1, "vm")),
      "integer",
    ],
    ["vs0", iff(equal("vt0", 0), 0, mul(2, sub("ve", ["Power", 2, sub("vt0", 1)]))), "integer"],
  ],
  iff(
    ["LessEqual", "vm", 1],
    1,
    sum(
      (x) =>
        iff(
          equal(x, add("vt0", 1)),
          at("vt", vexIndex(sub("vm", 1), "vt0", "vs0")),
          lets(
            [
              [
                "vt2",
                [
                  "Min",
                  sub("vm", 1),
                  fold(
                    iff(bit("vs0", "vq"), ["Min", "vtq", sub("vq", 1)], "vtq"),
                    "vtq",
                    "vq",
                    sub("vt0", 1),
                    upTo(x, sub("vt0", 1)),
                  ),
                ],
                "integer",
              ],
              ["vlow", ["Mod", "vs0", ["Power", 2, x]], "integer"],
              [
                "vs2",
                add(
                  "vlow",
                  iff(
                    and(["LessEqual", 2, x], ["LessEqual", x, sub("vm", 1)], ["Not", bit("vlow", sub(x, 1))]),
                    ["Power", 2, sub(x, 1)],
                    0,
                  ),
                ),
                "integer",
              ],
            ],
            at(
              "vt",
              vexIndex(sub("vm", 1), "vt2", iff(["GreaterEqual", "vt2", 1], ["Mod", "vs2", ["Power", 2, "vt2"]], 0)),
            ),
          ),
        ),
      "vx",
      1,
      ["Min", add("vt0", 1), "vm"],
    ),
  ),
);
const vexTable = fold(
  ["Join", "vt", tabulate(vexEntry, "ve", 0, sub(["Power", 2, "vb"], 1))],
  "vt",
  "vb",
  ["List"],
  upTo(0, n),
);
/** Free values below v. */
const freeUnder = (v: MathJSON): MathJSON => at("fr", v);
const vexDescent = (i: string, j: string): MathJSON => ["Greater", pre(i), pre(j)];
const vexillaryPermutations: EpsilFamily = permutationRestriction({
  head: "VexillaryPermutations",
  carrier: "Permutation",
  paramCount: 1,
  params: [n],
  declared: {
    carrier: "Permutation",
    params: [{ name: "size", role: "axis", min: 0 }],
    cost: { count: "enumerative", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
    // At least the count (Av(2143) is Wilf-equivalent to Av(1234), at most 9^n) and the table.
    work: ([size]) => 9n ** BigInt(size),
  },
  tables: ["vex", vexTable],
  taken: true,
  predicate: [
    "Not",
    fold(
      [
        "Or",
        "vpl_",
        fold(
          [
            "Or",
            "vpk_",
            fold(
              [
                "Or",
                "vpj_",
                fold(
                  [
                    "Or",
                    "vpi_",
                    and(
                      less(at("_x", "vpj"), at("_x", "vpi")),
                      less(at("_x", "vpi"), at("_x", "vpl")),
                      less(at("_x", "vpl"), at("_x", "vpk")),
                    ),
                  ],
                  "vpi_",
                  "vpi",
                  "False",
                  upTo(1, sub("vpj", 1)),
                ),
              ],
              "vpj_",
              "vpj",
              "False",
              upTo(1, sub("vpk", 1)),
            ),
          ],
          "vpk_",
          "vpk",
          "False",
          upTo(1, sub("vpl", 1)),
        ),
      ],
      "vpl_",
      "vpl",
      "False",
      upTo(1, n),
    ),
  ],
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
      // A 2143 ending at the last entry: the parent prefix has none.
      [
        "v2143",
        iff(
          fold(
            [
              "Or",
              "vck_",
              fold(
                [
                  "Or",
                  "vcj_",
                  fold(
                    ["Or", "vci_", and(less(pre("vcj"), pre("vci")), less(pre("vci"), last), less(last, pre("vck")))],
                    "vci_",
                    "vci",
                    "False",
                    upTo(1, sub("vcj", 1)),
                  ),
                ],
                "vcj_",
                "vcj",
                "False",
                upTo(1, sub("vck", 1)),
              ),
            ],
            "vck_",
            "vck",
            "False",
            upTo(1, sub("filled", 1)),
          ),
          1,
          0,
        ),
        "integer",
      ],
      [
        "vtt",
        fold(
          [
            "Min",
            "vti_",
            fold(
              iff(vexDescent("vti", "vtj"), ["Min", "vtj_", freeUnder(pre("vti"))], "vtj_"),
              "vtj_",
              "vtj",
              open,
              upTo(add("vti", 1), "filled"),
            ),
          ],
          "vti_",
          "vti",
          open,
          upTo(1, "filled"),
        ),
        "integer",
      ],
      // A 2-1-4 with a free value between its 2 and 4.
      [
        "vzero",
        iff(
          fold(
            [
              "Or",
              "vzi_",
              fold(
                [
                  "Or",
                  "vzj_",
                  and(
                    vexDescent("vzi", "vzj"),
                    fold(
                      [
                        "Or",
                        "vzk_",
                        and(less(pre("vzi"), pre("vzk")), [
                          "Greater",
                          sub(freeUnder(pre("vzk")), freeUnder(add(pre("vzi"), 1))),
                          0,
                        ]),
                      ],
                      "vzk_",
                      "vzk",
                      "False",
                      upTo(add("vzj", 1), "filled"),
                    ),
                  ),
                ],
                "vzj_",
                "vzj",
                "False",
                upTo(add("vzi", 1), "filled"),
              ),
            ],
            "vzi_",
            "vzi",
            "False",
            upTo(1, "filled"),
          ),
          1,
          0,
        ),
        "integer",
      ],
    ],
    iff(
      ["Greater", add("v2143", "vzero"), 0],
      0,
      iff(
        ["LessEqual", open, 1],
        1,
        at(
          "vex",
          vexIndex(
            open,
            "vtt",
            sum(
              (c) =>
                iff(
                  fold(["Or", "vsq_", equal(freeUnder(pre("vsq")), c)], "vsq_", "vsq", "False", upTo(1, "filled")),
                  ["Power", 2, c],
                  0,
                ),
              "vsc",
              1,
              sub("vtt", 1),
            ),
          ),
        ),
      ),
    ),
  ),
});

export const grassmannianPermutations = atMostOneTurn("GrassmannianPermutations", false);
export const cograssmannianPermutations = atMostOneTurn("CograssmannianPermutations", true);
export {
  adjacentTranspositionInvolutions,
  nonCrossingPermutations,
  alternatingPermutations,
  connectedPermutations,
  kDescentPermutations,
  nonCrossingCycleSupportPermutations,
  separablePermutations,
  vexillaryPermutations,
};
