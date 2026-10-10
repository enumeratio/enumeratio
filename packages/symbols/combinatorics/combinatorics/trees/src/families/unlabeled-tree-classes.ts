// RootedUnlabeledTrees and UnlabeledFreeTrees in Epsil. An element is the level sequence of a
// tree (depths in preorder, the root 0), the children of a node listed heaviest subtree first,
// and among subtrees of one size by their own rank.
//
// The children of a node are a multiset of subtrees. Let T(w) be the rooted trees of w nodes and
// G(rem, cap) the multisets of subtrees weighing rem in all, none over cap: G(0, cap) = 1 and
//   G(rem, cap) = Σ_k C(T(cap) + k − 1, k) G(rem − k cap, cap − 1),
// k the subtrees of weight cap, a multiset of k of the T(cap) trees; T(w) = G(w − 1, w − 1).
// A multiset is ranked by its heaviest class first: the classes before it (fewer subtrees of
// the weight, in turn for each weight from the top), then which multiset of T(cap) trees it
// holds, in the colex order of the combinatorial number system (a_j + j − 1 in place of a_j),
// then the rest of the children. The table G is `tables`.
//
// A tree of n nodes is ranked, unranked and checked by walking the level sequence. Rank and
// membership go from the last node to the first, a node's size and rank read off the sizes and
// ranks of the children after it (found by hopping from child to child). Unrank goes the other
// way, keeping the nodes still to be expanded as frames (depth, weight, rank) on a stack in the
// fold's list, behind the depths written so far.
//
// A free tree is rooted at its centroid: every subtree weighs at most n/2. For n even a tree
// with a subtree of exactly n/2 has two centroids, so it comes up twice among the rooted ones
// and is listed once, by its two halves a ≤ b in rank: after the trees with every subtree
// under n/2, row a of the triangle holding b = a..T(n/2) − 1.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  all,
  and,
  at,
  choose,
  equal,
  fold,
  iff,
  len,
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
const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const join = (...xs: MathJSON[]): MathJSON => ["Join", ...xs];
const drop = (xs: MathJSON, count: MathJSON): MathJSON => ["Drop", xs, count];
const take = (xs: MathJSON, count: MathJSON): MathJSON => ["Take", xs, count];
const length = (xs: MathJSON): MathJSON => ["Length", xs];
const replace = (xs: MathJSON, index: MathJSON, value: MathJSON): MathJSON => ["ReplaceAt", xs, index, value];
const not = (x: MathJSON): MathJSON => ["Not", x];
const or = (...xs: MathJSON[]): MathJSON => ["Or", ...xs];
const lessEqual = (a: MathJSON, b: MathJSON): MathJSON => ["LessEqual", a, b];
const greater = (a: MathJSON, b: MathJSON): MathJSON => ["Greater", a, b];
const down = (from: MathJSON, to: MathJSON): MathJSON => ["Range", from, to, -1];
const constant = (value: MathJSON, count: MathJSON): MathJSON => map(value, "wk_z", upTo(1, count));

/** The table's side: n, at least 1. */
const N: MathJSON = ["Max", n, 1];

/** C(a, b) for 0 ≤ b ≤ a. */
const binomial = (a: MathJSON, b: MathJSON): MathJSON => ["Binomial", a, b];

/** C(t + k − 1, k): the multisets of k from t ≥ 1 trees. */
const multichoose = (t: MathJSON, k: MathJSON): MathJSON => binomial(add(t, sub(k, 1)), k);

/** G(rem, cap) read from the table by rows cap = 0..n − 1, rem = 0..n − 1. Every read is of a
 *  weight a subtree can have, in a sequence checked to be a level sequence. */
const G = (rem: MathJSON, cap: MathJSON): MathJSON => at("_tables", add(mul(cap, N), rem, 1));
/** T(w), the rooted trees of w nodes. */
const T = (w: MathJSON): MathJSON => G(sub(w, 1), sub(w, 1));

const eulerTable: MathJSON = rowTable(
  "tr",
  N,
  N,
  (c) => iff(equal(c, 0), 1, 0),
  (prev, s, c) =>
    fold(
      add("tr_a", mul(multichoose(prev(sub(s, 1), sub(s, 1)), "tr_k"), prev(sub(s, 1), sub(c, mul("tr_k", s))))),
      "tr_a",
      "tr_k",
      0,
      upTo(0, quotient(c, s)),
    ),
);

/** Halvings of a range under 2^53, which 64 of them settle. */
const HALVINGS = upTo(1, 64);

/** The greatest x in lo..hi with `holds(x)` (holds on lo, and then on no x past the greatest). */
const greatest = (tag: string, lo: MathJSON, hi: MathJSON, holds: (x: MathJSON) => MathJSON): MathJSON => {
  const [b, mid] = ["b", "mid"].map((name) => `${tag}_${name}`);
  return at(
    fold(
      iff(
        less(at(b, 1), at(b, 2)),
        lets(
          [[mid, quotient(add(at(b, 1), at(b, 2), 1), 2), "integer"]],
          iff(holds(mid), list(mid, at(b, 2)), list(at(b, 1), sub(mid, 1))),
        ),
        b,
      ),
      b,
      `${tag}_h`,
      list(lo, hi),
      HALVINGS,
    ),
    1,
  );
};

/**
 * The subtrees `rank` names among the multisets of weight `rem` with none over `cap`, as a flat
 * list of (depth, weight, rank) frames, the heaviest first, in the order the subtrees stand in
 * the level sequence. Each weight takes the k that holds the rank, then the multiset of k trees
 * its digits in the multichoose number system name, the rest of the rank going to the lighter
 * weights.
 */
function subtrees(tag: string, depth: MathJSON, rem0: MathJSON, cap: MathJSON, rank: MathJSON): MathJSON {
  const [s, u, sc, k, kk, rem, ways, found, digits, i, left, top, j] = [
    "s",
    "u",
    "sc",
    "k",
    "kk",
    "rem",
    "ways",
    "found",
    "digits",
    "i",
    "left",
    "top",
    "j",
  ].map((name) => `${tag}_${name}`);
  const step = lets(
    [
      [rem, at(s, 1), "integer"],
      // [found, k, rank left]: the block of k holds C(T(u) + k − 1, k) multisets of k trees, each with every rest.
      [
        sc,
        fold(
          iff(
            equal(at(sc, 1), 1),
            sc,
            lets(
              [[`${tag}_blk`, mul(multichoose(T(u), k), G(sub(rem, mul(k, u)), sub(u, 1))), "integer"]],
              iff(less(at(sc, 3), `${tag}_blk`), list(1, k, at(sc, 3)), list(0, k, sub(at(sc, 3), `${tag}_blk`))),
            ),
          ),
          sc,
          k,
          list(0, 0, at(s, 2)),
          upTo(0, quotient(rem, u)),
        ),
        "list<integer>",
      ],
      [kk, at(sc, 2), "integer"],
      [ways, ["Max", G(sub(rem, mul(kk, u)), sub(u, 1)), 1], "integer"],
      // The digits c_kk, …, c_1 of the multiset's colex rank, found from the top.
      [
        digits,
        fold(
          lets(
            [
              [left, at(`${tag}_dg`, 1), "integer"],
              [
                top,
                greatest(`${tag}_g`, sub(i, 1), sub(at(`${tag}_dg`, 2), 1), (x) => lessEqual(choose(x, i), left)),
                "integer",
              ],
            ],
            join(list(sub(left, choose(top, i)), top), drop(`${tag}_dg`, 2), list(top)),
          ),
          `${tag}_dg`,
          i,
          list(quotient(at(sc, 3), ways), add(T(u), sub(kk, 1))),
          down(kk, 1),
        ),
        "list<integer>",
      ],
    ],
    join(
      list(sub(rem, mul(kk, u)), ["Mod", at(sc, 3), ways]),
      drop(s, 2),
      // The subtrees' types ascend: a_j = c_j − (j − 1), c_j the digit j places from the end.
      fold(
        join(found, list(depth, u, sub(at(digits, add(sub(add(kk, 1), j), 2)), sub(j, 1)))),
        found,
        j,
        list(),
        upTo(1, kk),
      ),
    ),
  );
  return drop(fold(step, s, u, list(rem0, rank), down(cap, 1)), 2);
}

/** A walk's state is [pairs out of order, pairs too heavy to order, sizes of 1..n, ranks of 1..n]:
 *  the size and rank of node j are read through `sz` and `rk`. */
const sz = (state: string, j: MathJSON): MathJSON => at(state, add(j, 2));
const rk = (state: string, j: MathJSON): MathJSON => at(state, add(n, j, 2));

/** The weight from which the trees of a weight outnumber what a double holds exactly: T(40) > 2^53. */
const HEAVY = 40;

/** The depths with a −1 after them, so a hop past the last node reads a depth no child has. */
const padded = (x: string): MathJSON => join(x, list(-1));

/**
 * A walk's step for node i whose children are after it: the flat list [next node, then each
 * child's (start, size, rank)], found by hopping from child to child while the depth is one more
 * than i's.
 */
const hop = (state: string, xs: string, i: MathJSON): MathJSON =>
  fold(
    lets(
      [
        ["wk_q", "wk_acc", "list<integer>"],
        ["wk_j", at("wk_acc", 1), "integer"],
      ],
      iff(
        and(lessEqual("wk_j", n), equal(at(xs, "wk_j"), add(at(xs, i), 1))),
        join(list(add("wk_j", sz(state, "wk_j"))), drop("wk_q", 1), list("wk_j", sz(state, "wk_j"), rk(state, "wk_j"))),
        "wk_q",
      ),
    ),
    "wk_acc",
    "wk_t",
    list(add(i, 1)),
    upTo(1, sub(n, i)),
  );

/**
 * The rank of a multiset whose subtrees are `kids` (a flat list of (start, size, rank), heaviest
 * first), weighing `rem0` in all: the state [rank, rem at the weight now counted, that weight, its
 * count, the number system's digits so far, the last size, the last rank, the pairs out of order,
 * the pairs of equal weight at HEAVY or more that differ, whose ranks a double can't order, the
 * last start] after the last of them. A weight is closed when a lighter one (or the 0 after the
 * last) comes. Two subtrees of one weight at HEAVY or more that are the same sequence are tied.
 */
function ranking(tag: string, kids: MathJSON, rem0: MathJSON): MathJSON {
  const [z, t, w, a, base, rem, cw, cnt, ss, pw, pa, bad, risk, kk, fin, acc, pad, st, ps, ix, iu] = [
    "z",
    "t",
    "w",
    "a",
    "base",
    "rem",
    "cw",
    "cnt",
    "ss",
    "pw",
    "pa",
    "bad",
    "risk",
    "kk",
    "fin",
    "acc",
    "pad",
    "st",
    "ps",
    "ix",
    "iu",
  ].map((name) => `${tag}_${name}`);
  const closing = add(
    fold(add(acc, mul(multichoose(T(cw), kk), G(sub(rem, mul(kk, cw)), sub(cw, 1)))), acc, kk, 0, upTo(0, sub(cnt, 1))),
    mul(ss, G(sub(rem, mul(cnt, cw)), sub(cw, 1))),
  );
  // Whether the subtree at `st` is the sequence of the one at `ps`: its depths less its first, the same.
  const same = equal(
    0,
    fold(
      add(ix, [
        "Abs",
        sub(sub(at("wk_xs", add(st, iu)), at("wk_xs", st)), sub(at("wk_xs", add(ps, iu)), at("wk_xs", ps))),
      ]),
      ix,
      iu,
      0,
      upTo(0, sub(w, 1)),
    ),
  );
  // Out of order by weight, or by rank among weights a double ranks exactly; and the pairs it can't.
  const order = (bad: MathJSON, risk: MathJSON): MathJSON[] => [
    add(bad, iff(or(greater(w, pw), and(equal(w, pw), less(w, HEAVY), less(a, pa))), 1, 0)),
    add(risk, iff(and(equal(w, pw), lessEqual(HEAVY, w)), iff(same, 0, 1), 0)),
  ];
  const step = lets(
    [
      [st, at(pad, sub(mul(3, t), 2)), "integer"],
      [w, at(pad, sub(mul(3, t), 1)), "integer"],
      [a, at(pad, mul(3, t)), "integer"],
      [ps, at(z, 10), "integer"],
      [base, at(z, 1), "integer"],
      [rem, at(z, 2), "integer"],
      [cw, at(z, 3), "integer"],
      [cnt, at(z, 4), "integer"],
      [ss, at(z, 5), "integer"],
      [pw, at(z, 6), "integer"],
      [pa, at(z, 7), "integer"],
      [bad, at(z, 8), "integer"],
      [risk, at(z, 9), "integer"],
    ],
    iff(
      equal(w, cw),
      list(base, rem, cw, add(cnt, 1), add(ss, binomial(add(a, cnt), add(cnt, 1))), w, a, ...order(bad, risk), st),
      lets(
        [[fin, iff(less(0, cw), closing, 0), "integer"]],
        list(add(base, fin), iff(less(0, cw), sub(rem, mul(cw, cnt)), rem), w, 1, a, w, a, ...order(bad, risk), st),
      ),
    ),
  );
  return lets(
    [[pad, join(kids, list(0, 0, 0)), "list<integer>"]],
    fold(step, z, t, list(0, rem0, 0, 0, 0, add(n, 1), 0, 0, 0, 0), upTo(1, add(quotient(length(kids), 3), 1))),
  );
}

// ─── the walk over a level sequence `_x`: sizes and ranks of nodes n..2 (or n..1) ───────────────

const X = "_x";
/** Every depth is a depth the parent allows: 1..(the one before) + 1, and the root is 0. */
const shaped: MathJSON = and(
  equal(at(X, 1), 0),
  all((i) => and(lessEqual(1, at(X, i)), lessEqual(at(X, i), add(at(X, sub(i, 1)), 1))), upTo(2, n), "wk_v"),
);

/** The state [pairs out of order so far, pairs too heavy to order, sizes of 1..n, ranks of 1..n]
 *  after nodes n down to `last`. */
const walk = (last: MathJSON): MathJSON =>
  fold(
    lets(
      [
        ["wk_hop", hop("wk_p", "wk_xs", "wk_i"), "list<integer>"],
        ["wk_size", sub(at("wk_hop", 1), "wk_i"), "integer"],
        ["wk_z", ranking("tw", drop("wk_hop", 1), sub("wk_size", 1)), "list<integer>"],
      ],
      replace(
        replace(
          replace(replace("wk_p", 1, add(at("wk_p", 1), at("wk_z", 8))), 2, add(at("wk_p", 2), at("wk_z", 9))),
          add("wk_i", 2),
          "wk_size",
        ),
        add(n, "wk_i", 2),
        at("wk_z", 1),
      ),
    ),
    "wk_p",
    "wk_i",
    join(list(0, 0), constant(1, n), constant(0, n)),
    down(n, last),
  );

/** The root's children as the walk left them: (start, size, rank) triples. */
const rootKids = (state: string): MathJSON =>
  lets([["wk_h", hop(state, "wk_xs", 1), "list<integer>"]], drop("wk_h", 1));

/** `body` with `wk_xs` the padded depths and `wk_w` the walk down to node `last`. */
const walked = (last: MathJSON, body: MathJSON): MathJSON =>
  lets(
    [
      ["wk_xs", padded(X), "list<integer>"],
      ["wk_w", walk(last), "list<integer>"],
      ["wk_k", rootKids("wk_w"), "list<integer>"],
    ],
    body,
  );

// ─── unrank: the walk from the root, nodes 2..n, the frames behind the depths written ──────────

/**
 * Membership: a level sequence of n nodes, each depth at most one below the one before, whose
 * walk `check`s out: `bad` is how many things it found wrong, `risk` how many it couldn't tell,
 * a pair of equal subtrees (or the two halves of a free tree) at HEAVY or more nodes, ordered by
 * ranks past what a double holds. Anything wrong is False whatever it couldn't tell; otherwise a
 * risk is neither True nor False, and declines.
 */
const member = (walk: (verdict: (bad: MathJSON, risk: MathJSON) => MathJSON) => MathJSON): MathJSON =>
  iff(
    and(lessEqual(1, n), equal(len, n)),
    iff(
      shaped,
      walk((bad, risk) => iff(less(0, bad), "False", iff(less(0, risk), 0, "True"))),
      "False",
    ),
    "False",
  );

/** The first `n` entries of the state [depths so far, frames] once `first` (the depths and frames
 *  left after node `from` − 1) is expanded a node at a time, nodes `from` to n. */
const expand = (first: MathJSON, from: number): MathJSON =>
  take(
    fold(
      lets(
        [
          ["tu_d", at("tu_s", "tu_i"), "integer"],
          ["tu_w", at("tu_s", add("tu_i", 1)), "integer"],
          ["tu_r", at("tu_s", add("tu_i", 2)), "integer"],
          ["tu_kids", subtrees("ts", add("tu_d", 1), sub("tu_w", 1), sub("tu_w", 1), "tu_r"), "list<integer>"],
        ],
        join(take("tu_s", sub("tu_i", 1)), list("tu_d"), "tu_kids", drop("tu_s", add("tu_i", 2))),
      ),
      "tu_s",
      "tu_i",
      first,
      upTo(from, n),
    ),
    n,
  );

/** The first n with more than 2^53 trees: T(40) = 11703780079612453, F(44) = 2.3e16 (tests check these). */
const ROOTED_PAST = 40;
const FREE_PAST = 44;

/** The longest sequence membership tries: the table is n² cells, and past about 650 nodes a double
 *  holds no tree count. */
const LONGEST = 400;

/** What a sequence must be to be a tree, without a table: n ≥ 1 nodes, the root 0, each depth
 *  1 to one more than the one before. Longer than LONGEST declines, not no. */
const shapedMember = (element: unknown, [m]: readonly number[]): false | "decline" | undefined => {
  const x = element as readonly number[];
  if (!(m >= 1) || x.length !== m || x[0] !== 0) return false;
  for (let i = 1; i < x.length; i++) if (!(x[i] >= 1 && x[i] <= x[i - 1] + 1)) return false;
  return m > LONGEST ? "decline" : undefined;
};

/** Plausible's reading: a call walks one step for each node, and iterating the family is gated
 *  by its count, like the other walking families. */
const declaredFor = (carrier: string): EpsilFamily["declared"] => ({
  carrier,
  params: [{ name: "n", role: "axis", min: 0 }],
  cost: { count: "polynomial", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
  work: ([m]) => BigInt(m),
  walks: true,
});

const odd: MathJSON = equal(["Mod", n, 2], 1);
const half: MathJSON = quotient(n, 2);

export const rootedUnlabeledTrees: EpsilFamily = {
  head: "RootedUnlabeledTrees",
  paramCount: 1,
  kind: "ints",
  carrier: "RootedUnlabeledTree",
  params: [n],
  // Only a count a double holds is answered, from compiled code: the table is minutes of interpreting past it.
  declinePastDoubles: "count",
  early: { pastDoubles: ([m]) => !(m < ROOTED_PAST), member: shapedMember },
  declared: declaredFor("RootedUnlabeledTree"),
  epsil: {
    count: iff(less(n, 1), 0, T(n)),
    tables: eulerTable,
    unrank: expand(list(0, n, "_r"), 1),
    rank: walked(2, at(ranking("tf", "wk_k", sub(n, 1)), 1)),
    valid: member((verdict) =>
      walked(
        2,
        lets(
          [["wk_z", ranking("tf", "wk_k", sub(n, 1)), "list<integer>"]],
          verdict(add(at("wk_w", 1), at("wk_z", 8)), add(at("wk_w", 2), at("wk_z", 9))),
        ),
      ),
    ),
  },
};

/** The family's count when it is odd (one rooting at the centroid) and even (the rootings with
 *  no half, then the triangle of pairs of halves a ≤ b). */
const pairs = (m: MathJSON): MathJSON => binomial(add(T(m), 1), 2);

export const unlabeledFreeTrees: EpsilFamily = {
  head: "UnlabeledFreeTrees",
  paramCount: 1,
  kind: "ints",
  carrier: "UnlabeledFreeTree",
  params: [n],
  declinePastDoubles: "count",
  early: { pastDoubles: ([m]) => !(m < FREE_PAST), member: shapedMember },
  declared: declaredFor("UnlabeledFreeTree"),
  epsil: {
    count: iff(less(n, 1), 0, iff(odd, G(sub(n, 1), half), add(G(sub(n, 1), sub(half, 1)), pairs(half)))),
    tables: eulerTable,
    // The root's children: the multisets of weight n − 1 under the weight half (n odd), or under
    // half − 1, then the pairs of halves (n even), whose first half is a frame of its own.
    unrank: (() => {
      const k0 = iff(odd, 0, G(sub(n, 1), sub(half, 1)));
      const r2 = sub("_r", k0);
      const off = (a: MathJSON): MathJSON => sub(pairs(half), binomial(add(sub(T(half), a), 1), 2));
      const [pair, a] = ["tu_pair", "tu_a"];
      return lets(
        [
          [pair, and(not(odd), lessEqual(k0, "_r")), "boolean"],
          [
            a,
            iff(
              pair,
              greatest("tg", 0, sub(T(half), 1), (x) => lessEqual(off(x), r2)),
              0,
            ),
            "integer",
          ],
          [
            "tu_roots",
            join(
              iff(pair, list(1, half, a), list()),
              subtrees(
                "tr",
                1,
                iff(pair, sub(half, 1), sub(n, 1)),
                iff(odd, half, sub(half, 1)),
                iff(pair, add(a, sub(r2, off(a))), "_r"),
              ),
            ),
            "list<integer>",
          ],
        ],
        expand(join(list(0), "tu_roots"), 2),
      );
    })(),
    rank: (() => {
      const first = iff(less(0, length("wk_k")), at("wk_k", 2), 0);
      const b = iff(less(1, length("wk_k")), at("wk_k", 3), 0);
      const second = at(ranking("tt", drop("wk_k", 3), sub(half, 1)), 1);
      return walked(
        2,
        iff(
          or(odd, equal(length("wk_k"), 0), less(first, half)),
          at(ranking("tf", "wk_k", sub(n, 1)), 1),
          add(G(sub(n, 1), sub(half, 1)), sub(pairs(half), binomial(add(sub(T(half), b), 1), 2)), sub(second, b)),
        ),
      );
    })(),
    valid: (() => {
      const first = iff(less(0, length("wk_k")), at("wk_k", 2), 0);
      const b = iff(less(1, length("wk_k")), at("wk_k", 3), 0);
      const second = at(ranking("tt", drop("wk_k", 3), sub(half, 1)), 1);
      // Two centroids: the halves a ≤ b, by rank. The first half is the sequence at 2..half + 1 less
      // a depth, the other the root and the rest, whose depths are the sequence's from half + 2.
      const halves = and(not(odd), equal(first, half));
      const twins = equal(
        0,
        fold(
          add("wk_d", ["Abs", sub(sub(at(X, add(2, "wk_u")), 1), at(X, add(half, 1, "wk_u")))]),
          "wk_d",
          "wk_u",
          0,
          upTo(1, sub(half, 1)),
        ),
      );
      return member((verdict) =>
        walked(
          2,
          lets(
            [["wk_z", ranking("tf", "wk_k", sub(n, 1)), "list<integer>"]],
            verdict(
              add(
                at("wk_w", 1),
                at("wk_z", 8),
                iff(and(less(1, n), less(half, first)), 1, 0),
                iff(and(halves, less(half, HEAVY), less(second, b)), 1, 0),
              ),
              add(at("wk_w", 2), at("wk_z", 9), iff(and(halves, lessEqual(HEAVY, half), not(twins)), 1, 0)),
            ),
          ),
        ),
      );
    })(),
  },
};
