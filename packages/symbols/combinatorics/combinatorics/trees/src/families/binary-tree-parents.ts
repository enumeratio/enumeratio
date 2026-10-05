// BinaryTreeParentArrays in Epsil. A binary tree's in-order parent array is read through the
// intervals its subtrees occupy: the root of nodes lo..hi is node v = lo + i, its left subtree
// the interval lo..v − 1 and its right v + 1..hi. Trees are listed by the left subtree's size i,
// then by its rank, then the right's, so a tree of n nodes has rank
//   Σ_{j < i} C_j C_(n−1−j) + rank(left) C_(n−1−i) + rank(right)   (C the Catalan numbers).
// Unrank, rank and membership walk the intervals with an explicit stack of frames kept in the
// fold's list, one node per step, since nothing recurses in Epsil. The state is the stack's
// height, then what the walk produces, then the frames: popping reads the top frame, and its
// children's frames go where it was.

import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
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
import { zeros } from "./peel.ts";
import { frames, heightAfter, writes } from "./stack.ts";

type MathJSON = unknown;

const N = "_n";
const parents = "_x";
/** Catalan number C_k, read from the table. */
const C = (k: MathJSON): MathJSON => at("_tables", add(k, 1));

/** C_0..C_n: C_(k+1) = Σ_{i ≤ k} C_i C_(k−i). */
const catalanTable: MathJSON = fold(
  [
    "ReplaceAt",
    "ct",
    add("ck", 2),
    fold(add("cs", mul(at("ct", add("ci", 1)), at("ct", add(sub("ck", "ci"), 1)))), "cs", "ci", 0, upTo(0, "ck")),
  ],
  "ct",
  "ck",
  ["Join", ["List", 1], zeros(N)],
  upTo(0, sub(N, 1)),
);

// ─── unrank: state [height, parent of each of 1..n, frames (lo, size, parent, rank)] ───────────

const unrankFrames = frames(add(N, 1), 4);
const unrankTop = "ut";
const field = (c: number): MathJSON => unrankFrames.field("us", unrankTop, c);
const unrankState: MathJSON = fold(
  lets(
    [
      [unrankTop, at("us", 1), "integer"],
      ["ulo", field(1), "integer"],
      ["usz", field(2), "integer"],
      ["upar", field(3), "integer"],
      // [rank within the block, left size, found]: the block of left size j holds C_j C_(size − 1 − j) trees.
      [
        "ufound",
        fold(
          iff(
            equal(at("uf", 3), 1),
            "uf",
            iff(
              less(at("uf", 1), mul(C("uj"), C(sub(sub("usz", 1), "uj")))),
              ["List", at("uf", 1), "uj", 1],
              ["List", sub(at("uf", 1), mul(C("uj"), C(sub(sub("usz", 1), "uj")))), "uj", 0],
            ),
          ),
          "uf",
          "uj",
          ["List", field(4), 0, 0],
          upTo(0, sub("usz", 1)),
        ),
        "list<integer>",
      ],
      ["ui", at("ufound", 2), "integer"],
      ["uright", sub(sub("usz", 1), at("ufound", 2)), "integer"],
      ["ucr", C(sub(sub("usz", 1), at("ufound", 2))), "integer"],
    ],
    writes(
      "us",
      [1, heightAfter(unrankTop, less(0, "ui"), less(0, "uright"))],
      [add("ulo", "ui", 1), "upar"],
      ...unrankFrames.push(
        unrankTop,
        less(0, "ui"),
        ["ulo", "ui", add("ulo", "ui"), quotient(at("ufound", 1), "ucr")],
        [add("ulo", "ui", 1), "uright", add("ulo", "ui"), ["Mod", at("ufound", 1), "ucr"]],
      ),
    ),
  ),
  "us",
  "uk",
  ["Join", ["List", 1], zeros(N), ["List", 1, N, 0, "_r"], zeros(mul(4, add(N, 1)))],
  upTo(1, N),
);
const unrank: MathJSON = lets(
  [["ufinal", unrankState, "list<integer>"]],
  map(at("ufinal", add("uv", 1)), "uv", upTo(1, N)),
);

// ─── rank: state [height, rank so far, frames (lo, hi, multiplier)] ────────────────────────────
// A subtree's rank counts for as many ranks as the trees that can follow it: its right sibling
// subtree's C, times its parent's multiplier; a right subtree keeps its parent's.

const rankFrames = frames(2, 3);
const outside = (j: MathJSON, lo: MathJSON, hi: MathJSON): MathJSON => [
  "Or",
  less(at(parents, j), lo),
  less(hi, at(parents, j)),
];
/** The root of nodes lo..hi: the one whose parent lies outside them (0 when none does). */
const rootOf = (lo: MathJSON, hi: MathJSON, tag: string): MathJSON =>
  fold(iff(outside(`${tag}j`, lo, hi), `${tag}j`, `${tag}f`), `${tag}f`, `${tag}j`, 0, upTo(lo, hi));

const rankState: MathJSON = fold(
  lets(
    [
      ["rt", at("rs", 1), "integer"],
      ["rlo", rankFrames.field("rs", "rt", 1), "integer"],
      ["rhi", rankFrames.field("rs", "rt", 2), "integer"],
      ["rm", rankFrames.field("rs", "rt", 3), "integer"],
      ["rv", rootOf("rlo", "rhi", "r"), "integer"],
      [
        "rbase",
        fold(
          add("ra", mul(C("rj"), C(sub(sub("rhi", "rlo"), "rj")))),
          "ra",
          "rj",
          0,
          upTo(0, sub(sub("rv", "rlo"), 1)),
        ),
        "integer",
      ],
    ],
    writes(
      "rs",
      [1, heightAfter("rt", less("rlo", "rv"), less("rv", "rhi"))],
      [2, add(at("rs", 2), mul("rm", "rbase"))],
      ...rankFrames.push(
        "rt",
        less("rlo", "rv"),
        ["rlo", sub("rv", 1), mul("rm", C(sub("rhi", "rv")))],
        [add("rv", 1), "rhi", "rm"],
      ),
    ),
  ),
  "rs",
  "rk",
  ["Join", ["List", 1, 0, 1, N, 1], zeros(mul(3, add(N, 1)))],
  upTo(1, N),
);
const rank: MathJSON = at(rankState, 2);

// ─── membership: the same walk, state [height, 1 while every interval is sound, frames
// (lo, hi, parent expected of the interval's root)] ─────────────────────────────────────────────
// An interval is sound when exactly one of its nodes has a parent outside it, and that parent is
// the expected one; its two sides are then checked with the root as their parent.

const checkFrames = frames(2, 3);
const checkState: MathJSON = fold(
  lets(
    [
      ["ct", at("cs", 1), "integer"],
      ["clo", checkFrames.field("cs", "ct", 1), "integer"],
      ["chi", checkFrames.field("cs", "ct", 2), "integer"],
      ["cq", checkFrames.field("cs", "ct", 3), "integer"],
      ["cn", fold(add("cc", iff(outside("cj", "clo", "chi"), 1, 0)), "cc", "cj", 0, upTo("clo", "chi")), "integer"],
      ["cr", rootOf("clo", "chi", "c"), "integer"],
      ["cv", iff(equal("cr", 0), "clo", "cr"), "integer"],
    ],
    writes(
      "cs",
      [1, heightAfter("ct", less("clo", "cv"), less("cv", "chi"))],
      [2, iff(and(equal("cn", 1), equal(at(parents, "cv"), "cq")), at("cs", 2), 0)],
      ...checkFrames.push("ct", less("clo", "cv"), ["clo", sub("cv", 1), "cv"], [add("cv", 1), "chi", "cv"]),
    ),
  ),
  "cs",
  "ck",
  ["Join", ["List", 1, 1, 1, N, 0], zeros(mul(3, add(N, 1)))],
  upTo(1, N),
);

const binaryTreeParentArrays: EpsilFamily = {
  declared: {
    carrier: "BinaryTreeParentArray",
    params: [{ name: "n", role: "axis", min: 0 }],
    cost: { count: "closed", unrank: "polynomial", rank: "polynomial", valid: "polynomial" },
  },
  head: "BinaryTreeParentArrays",
  paramCount: 1,
  kind: "ints",
  carrier: "BinaryTreeParentArray",
  params: ["_n"],
  // Interpreting the stack walk takes seconds a call past 2^53, so unrank and rank decline there.
  declinePastDoubles: true,
  epsil: {
    count: iff(less(N, 0), 0, C(N)),
    tables: catalanTable,
    unrank,
    rank,
    valid: iff(
      equal(["Length", parents], N),
      iff(
        all((i) => and(["LessEqual", 0, at(parents, i)], ["LessEqual", at(parents, i), N]), upTo(1, N), "vi"),
        equal(at(checkState, 2), 1),
        "False",
      ),
      "False",
    ),
  },
};

export { binaryTreeParentArrays };
