// Restrictions of the symmetric group by descents, alternation and indecomposability, in its lex
// order: each is its completion count (`permutationRestriction`, collections/src/families/
// lex-restriction.ts). Over `prefix` (n slots, the first `filled` set) the counts read the
// prefix's last entry, how many free values lie below it (a), and m = n − filled free slots.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import type { Declared } from "../../../collections/src/families/types.ts";
import { permutationRestriction } from "../../../collections/src/families/lex-restriction.ts";
import {
  add,
  at,
  cell,
  fold,
  iff,
  lets,
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

export const grassmannianPermutations = atMostOneTurn("GrassmannianPermutations", false);
export const cograssmannianPermutations = atMostOneTurn("CograssmannianPermutations", true);
export { alternatingPermutations, connectedPermutations, kDescentPermutations };
