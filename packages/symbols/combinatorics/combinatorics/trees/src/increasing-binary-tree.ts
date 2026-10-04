// Increasing binary tree from a permutation, by minimum-splitting recursion — the
// FromPermutation map (permutation -> increasing_binary_tree). This is the CARTESIAN TREE on
// the permutation's values, min-heap ordered: recursively, the position of the smallest value
// in the current range becomes the node, everything before it is the LEFT subtree (same
// recursion), everything after it the RIGHT. Every permutation of [n] holds the value 1, so
// the root is always labelled 1 — heap order puts the global minimum at the top regardless of
// which permutation it came from.
//
// REPRESENTATION. `increasing_binary_tree`'s declared shape (carrier-data.ts) is
// `integer | list<any>` — BinaryTree/FullKAryTree/OrderedTree's own nested convention, label
// folded in as the node's first slot: leaf 0, node [label, left, right]. This is what
// IncreasingBinaryTrees (collections/src/families/tableaux-trees.ts, its `cartesianTree`)
// already builds, so FromPermutation has to build the same shape rather than the flat
// by-value parent-array tuple this file built before (A-116).
//
// THE NEAREST-SMALLER-VALUE CHARACTERISATION. The rule from tableau.ts: iterate over a RANGE
// and index, never fold or filter over a list carved out of the accumulator. The recursive
// min-splitting has a direct, non-recursive characterisation — position i's parent is whichever
// of its nearest smaller neighbour to the LEFT (L) and to the RIGHT (R) exists and is the
// tighter bound — the one with the LARGER value, when both exist (permutation values are
// distinct, so there is never a tie). `i` is L's RIGHT child (i lies to L's right) or R's LEFT
// child (i lies to R's left). That still holds — it is what makes `childPositionOnSide` below a
// plain fold rather than a search — but the tree ITSELF is now assembled with real recursion
// (`recurse`/`self`, @enumeratio/structures — "a fold can't build a nested value; this can"),
// walking down from the root position rather than building flat left/right arrays by value.

import { recurse, self } from "../../src/recursion.ts";

// `unknown`, not a strict recursive union: `recurse`/`self` (@enumeratio/structures) are typed
// over `unknown` themselves, same as binary-tree.ts's own use of them.
type MathJSON = unknown;

const at = (list: MathJSON, index: MathJSON): MathJSON => ["At", list, index];
const count = (list: MathJSON): MathJSON => ["Count", list];

const overRange = (n: MathJSON, initial: MathJSON, step: MathJSON, accumulator: string, variable: string): MathJSON => [
  "Fold",
  ["Function", step, accumulator, variable],
  initial,
  ["Range", 1, n, 1],
];

/** `body` with `name` bound to `value` — a `let`, as a lambda applied to its argument. Same
 *  helper as map.ts / tableau.ts: a sub-term read more than once (here, each of the two
 *  nearest-smaller scans) is computed once rather than rebuilt at every reference. */
const bind = (name: string, value: MathJSON, body: MathJSON): MathJSON => ["Apply", ["Function", body, name], value];

const WORD: MathJSON = "_raw";
const SIZE: MathJSON = count(WORD);
const val = (i: MathJSON): MathJSON => at(WORD, i);
const posOf = (v: MathJSON): MathJSON => ["IndexOf", WORD, v];

/** Nearest position left of `i` with a smaller value than `i`'s — 0 if none. Folding ascending
 *  and overwriting on every match leaves the LARGEST matching position, the closest one. */
const nearestSmallerLeft = (i: MathJSON): MathJSON =>
  overRange(SIZE, 0, ["If", ["And", ["Less", "jl", i], ["Less", val("jl"), val(i)]], "jl", "accl"], "accl", "jl");

/** Nearest position right of `i` with a smaller value — 0 if none. Freezing once a match is
 *  found (the accumulator stays 0 until then) leaves the SMALLEST matching position, the
 *  closest one on this side. */
const nearestSmallerRight = (i: MathJSON): MathJSON =>
  overRange(
    SIZE,
    0,
    [
      "If",
      ["Equal", "accr", 0],
      ["If", ["And", ["Greater", "jr", i], ["Less", val("jr"), val(i)]], "jr", "accr"],
      "accr",
    ],
    "accr",
    "jr",
  );

/** `i`'s parent position under minimum-splitting recursion, 0 at the root (the global
 *  minimum). */
const parentPos = (i: MathJSON): MathJSON =>
  bind("nsl", nearestSmallerLeft(i), [
    "Apply",
    [
      "Function",
      [
        "If",
        ["And", ["Equal", "nsl", 0], ["Equal", "nsr", 0]],
        0,
        [
          "If",
          ["Equal", "nsl", 0],
          "nsr",
          ["If", ["Equal", "nsr", 0], "nsl", ["If", ["Greater", val("nsl"), val("nsr")], "nsl", "nsr"]],
        ],
      ],
      "nsr",
    ],
    nearestSmallerRight(i),
  ]);

/** The POSITION of `i`'s child on `side` of its parent — `i` lies left of a right-side parent,
 *  or right of a left-side parent — 0 (no position) if `i` has no such child. At most one
 *  position can match a given (parent, side) pair, so overwriting on every match is exact. */
const childPositionOnSide = (parentPosition: MathJSON, side: "left" | "right"): MathJSON =>
  overRange(
    SIZE,
    0,
    [
      "If",
      [
        "And",
        ["Equal", parentPos("ci"), parentPosition],
        side === "left" ? ["Less", "ci", parentPosition] : ["Greater", "ci", parentPosition],
      ],
      "ci",
      "cacc",
    ],
    "cacc",
    "ci",
  );

/** The node at position `p` — 0 (leaf) at position 0, otherwise `[val(p), left, right]`,
 *  recursing on the child POSITIONS `childPositionOnSide` finds. Real recursion
 *  (`recurse`/`self`), not a fold: assembling a nested value needs it. */
const nodeAt = (p: MathJSON): MathJSON => [
  "If",
  ["Equal", p, 0],
  0,
  ["List", val(p), self(childPositionOnSide(p, "left")), self(childPositionOnSide(p, "right"))],
];

/** The whole tree: the node rooted at the position of value 1 — every permutation of [n] holds
 *  the value 1, and heap order puts the global minimum at the top regardless of which
 *  permutation it came from, so that position is always the root. */
export const fromPermutationTree: MathJSON = recurse(nodeAt("p"), ["p"], posOf(1));
