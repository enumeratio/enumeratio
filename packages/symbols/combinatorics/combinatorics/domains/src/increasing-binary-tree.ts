// Increasing binary tree from a permutation, by minimum-splitting recursion — the
// FromPermutation map (permutation -> increasing_binary_tree). This is the CARTESIAN TREE on
// the permutation's values, min-heap ordered: recursively, the position of the smallest value
// in the current range becomes the node, everything before it is the LEFT subtree (same
// recursion), everything after it the RIGHT. Every permutation of [n] holds the value 1, so
// the root is always labelled 1 — heap order puts the global minimum at the top regardless of
// which permutation it came from.
//
// REPRESENTATION. `increasing_binary_tree`'s declared shape (domain-data.ts) is
// `tuple<integer, list<integer>, list<integer>>` — root, then left_child/right_child arrays
// indexed BY VALUE, 0 meaning no child. Same parent-pointer-by-VALUE convention bst.ts chose
// for `binary_tree`, for the same reason: a value's identity is fixed the moment it is placed,
// so indexing by it (rather than by tree position) needs no separate node-numbering scheme.
//
// AVOIDING RECURSION. The rule from tableau.ts: iterate over a RANGE and index, never fold or
// filter over a list carved out of the accumulator. The recursive min-splitting has a direct,
// non-recursive characterisation — the "nearest smaller value" fact behind the standard linear
// Cartesian-tree construction: position i's parent is whichever of its nearest smaller
// neighbour to the LEFT (L) and to the RIGHT (R) exists and is the tighter bound — the one
// with the LARGER value, when both exist (permutation values are distinct, so there is never a
// tie). `i` is L's RIGHT child (i lies to L's right) or R's LEFT child (i lies to R's left).

type MathJSON = string | number | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };

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

/** The value of `i`'s child on `side` of its parent — `i` lies left of a right-side parent, or
 *  right of a left-side parent — 0 if `i` has no such child. At most one position can match a
 *  given (parent, side) pair, so overwriting on every match is exact. */
const childOnSide = (parentPosition: MathJSON, side: "left" | "right"): MathJSON =>
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
      val("ci"),
      "cacc",
    ],
    "cacc",
    "ci",
  );

/** `left_child` / `right_child`, indexed by value 1..n: for each value `v`, its child on
 *  `side`, read off `_raw` by folding over v = 1..n and indexing — never a fold over a list
 *  taken out of the accumulator (tableau.ts). */
const childList = (side: "left" | "right"): MathJSON =>
  overRange(SIZE, ["List"], ["Join", "lracc", ["List", childOnSide(posOf("lrv"), side)]], "lracc", "lrv");

/** The root's label — always 1, since every permutation of [n] holds the value 1 and heap
 *  order puts the global minimum at the top. */
export const fromPermutationRoot: MathJSON = 1;
export const fromPermutationLeftChild: MathJSON = childList("left");
export const fromPermutationRightChild: MathJSON = childList("right");
