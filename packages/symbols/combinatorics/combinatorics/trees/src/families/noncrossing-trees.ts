// NonCrossingTrees in Epsil: the preorder arity word of a ternary tree with n internal nodes (an
// internal node is a 3, a leaf a 0), the trees listed as FullKAryTrees(n, 3) lists them. A forest
// of k trees with m internal nodes in all numbers F(m, k) (k = 0..3, a table: F(m, 0) = [m = 0],
// F(m, k) = Σ_i T(i) F(m − i, k − 1), and a tree T(s) = F(s − 1, 3), T(0) = 1); a forest is ranked by its first tree's size s, then that tree's rank, then the
// rest's:
//   Σ_{t < s} T(t) F(m − t, k − 1) + rank(first) F(m − s, k − 1) + rank(rest).
// The word is walked in preorder with an explicit stack of pending forests (see
// ./binary-tree-parents.ts): each step pops one and emits (unrank) or reads (rank) its first
// tree's root, whose own children become the forest on top.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  and,
  at,
  equal,
  fold,
  iff,
  len,
  less,
  lets,
  map,
  mul,
  quotient,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";
import { frames, heightAfter, writes } from "./stack.ts";
import { zeros } from "./peel.ts";

type MathJSON = unknown;

const N = "_n";
/** The table's size is that of n clamped at 0, so a negative n has an empty fiber, not an error. */
const top: MathJSON = ["Max", N, 0];

/** The word's length, 3n + 1. */
const wordLength: MathJSON = add(mul(3, N), 1);
/** The steps of a walk: one per node below the root. */
const steps: MathJSON = mul(3, N);
const stackSlots: MathJSON = mul(3, add(mul(2, N), 4));

/** F(m, k) read from the table, 0 for m < 0. */
const forests = (m: MathJSON, k: MathJSON): MathJSON => iff(less(m, 0), 0, at("_tables", tableCell(k, m)));
const trees = (s: MathJSON): MathJSON => forests(s, 1);

/** Entry (k, m) of the forest table, k = 0..3 and m = 0..n. */
const tableCell = (k: MathJSON, m: MathJSON): MathJSON => add(mul(k, add(top, 1)), m, 1);
/** The table, filled a column m at a time: the trees T(m), then F(m, 2) and F(m, 3) from them.
 *  Each is a sum of products no larger than the entry itself, so every cell a fiber that fits a
 *  double reads is exact. */
const forestTable: MathJSON = fold(
  lets(
    [
      [
        "fa",
        ["ReplaceAt", "ft", tableCell(1, "fm"), iff(equal("fm", 0), 1, at("ft", tableCell(3, sub("fm", 1))))],
        "list<integer>",
      ],
      [
        "fb",
        [
          "ReplaceAt",
          "fa",
          tableCell(2, "fm"),
          fold(
            add("fs", mul(at("fa", tableCell(1, "fi")), at("fa", tableCell(1, sub("fm", "fi"))))),
            "fs",
            "fi",
            0,
            upTo(0, "fm"),
          ),
        ],
        "list<integer>",
      ],
    ],
    [
      "ReplaceAt",
      "fb",
      tableCell(3, "fm"),
      fold(
        add("fs", mul(at("fa", tableCell(1, "fi")), at("fb", tableCell(2, sub("fm", "fi"))))),
        "fs",
        "fi",
        0,
        upTo(0, "fm"),
      ),
    ],
  ),
  "ft",
  "fm",
  ["ReplaceAt", zeros(mul(4, add(top, 1))), 1, 1],
  upTo(0, top),
);

// ─── unrank: state [height, the word, frames (internal nodes left, trees left, rank)] ──────────

const unrankFrames = frames(add(wordLength, 1), 3);
const uf = (c: number): MathJSON => unrankFrames.field("us", "ut", c);
const unrankState: MathJSON = fold(
  lets(
    [
      ["ut", at("us", 1), "integer"],
      ["um", uf(1), "integer"],
      ["uk", uf(2), "integer"],
      // [rank within the block, first tree's size, found]: the block of size s holds T(s) F(m − s, k − 1) forests.
      [
        "ufound",
        fold(
          iff(
            equal(at("ua", 3), 1),
            "ua",
            iff(
              less(at("ua", 1), mul(trees("ush"), forests(sub("um", "ush"), sub("uk", 1)))),
              ["List", at("ua", 1), "ush", 1],
              ["List", sub(at("ua", 1), mul(trees("ush"), forests(sub("um", "ush"), sub("uk", 1)))), "ush", 0],
            ),
          ),
          "ua",
          "ush",
          ["List", uf(3), 0, 0],
          upTo(0, "um"),
        ),
        "list<integer>",
      ],
      ["usz", at("ufound", 2), "integer"],
      ["urest", forests(sub("um", at("ufound", 2)), sub("uk", 1)), "integer"],
    ],
    writes(
      "us",
      [1, heightAfter("ut", less(1, "uk"), less(0, "usz"))],
      [add("ustep", 2), iff(less(0, "usz"), 3, 0)],
      ...unrankFrames.push(
        "ut",
        less(1, "uk"),
        [sub("um", "usz"), sub("uk", 1), ["Mod", at("ufound", 1), "urest"]],
        [sub("usz", 1), 3, quotient(at("ufound", 1), "urest")],
      ),
    ),
  ),
  "us",
  "ustep",
  ["Join", ["List", 1, iff(less(0, N), 3, 0)], zeros(steps), ["List", sub(N, 1), 3, "_r"], zeros(stackSlots)],
  upTo(1, steps),
);
const unrank: MathJSON = lets(
  [["ufinal", unrankState, "list<integer>"]],
  map(at("ufinal", add("uv", 1)), "uv", upTo(1, wordLength)),
);

// ─── rank: state [height, rank so far, frames (internal nodes left, trees left, multiplier)] ───
// A first tree's rank counts for as many ranks as the rest of its forest can take, F(m − s, k − 1),
// times its forest's multiplier; the rest keeps the multiplier.

const rankFrames = frames(2, 3);
const word = (j: MathJSON): MathJSON => at("_x", j);
const rankState: MathJSON = fold(
  lets(
    [
      ["rt", at("rs", 1), "integer"],
      ["rm", rankFrames.field("rs", "rt", 1), "integer"],
      ["rk", rankFrames.field("rs", "rt", 2), "integer"],
      ["rmult", rankFrames.field("rs", "rt", 3), "integer"],
      // The subtree at position step + 1: [open slots, internal nodes], read until no slot is open.
      [
        "rsub",
        fold(
          iff(equal(at("rb", 1), 0), "rb", [
            "List",
            sub(add(at("rb", 1), word("rj")), 1),
            add(at("rb", 2), iff(equal(word("rj"), 3), 1, 0)),
          ]),
          "rb",
          "rj",
          ["List", 1, 0],
          upTo(add("rstep", 1), len),
        ),
        "list<integer>",
      ],
      ["rsz", at("rsub", 2), "integer"],
      ["rfit", forests(sub("rm", "rsz"), sub("rk", 1)), "integer"],
      [
        "rbefore",
        fold(
          add("rc", mul(trees("rq"), forests(sub("rm", "rq"), sub("rk", 1)))),
          "rc",
          "rq",
          0,
          upTo(0, sub("rsz", 1)),
        ),
        "integer",
      ],
    ],
    writes(
      "rs",
      [1, heightAfter("rt", less(1, "rk"), less(0, "rsz"))],
      [2, add(at("rs", 2), mul("rmult", "rbefore"))],
      ...rankFrames.push(
        "rt",
        less(1, "rk"),
        [sub("rm", "rsz"), sub("rk", 1), "rmult"],
        [sub("rsz", 1), 3, mul("rmult", "rfit")],
      ),
    ),
  ),
  "rs",
  "rstep",
  ["Join", ["List", 1, 0, sub(N, 1), 3, 1], zeros(stackSlots)],
  upTo(1, steps),
);
const rank: MathJSON = at(rankState, 2);

/** Membership: every entry a 0 or 3, the word reading as exactly one tree (open slots never
 *  run out early and end at none) with n internal nodes. State [open slots, internal nodes, bad]. */
const walk: MathJSON = fold(
  [
    "List",
    sub(add(at("wa", 1), word("wj")), 1),
    add(at("wa", 2), iff(equal(word("wj"), 3), 1, 0)),
    iff(and(equal(at("wa", 3), 0), less(0, at("wa", 1)), ["Or", equal(word("wj"), 0), equal(word("wj"), 3)]), 0, 1),
  ],
  "wa",
  "wj",
  ["List", 1, 0, 0],
  upTo(1, len),
);

export const nonCrossingTrees: EpsilFamily = {
  head: "NonCrossingTrees",
  paramCount: 1,
  kind: "ints",
  carrier: "NonCrossingTree",
  params: ["_n"],
  // Interpreting the stack walk takes seconds a call past 2^53, so unrank and rank decline there.
  declinePastDoubles: true,
  epsil: {
    count: iff(less(N, 0), 0, trees(N)),
    tables: forestTable,
    unrank,
    rank,
    valid: lets(
      [["wend", walk, "list<integer>"]],
      and(equal(at("wend", 1), 0), equal(at("wend", 3), 0), equal(at("wend", 2), N)),
    ),
  },
};
