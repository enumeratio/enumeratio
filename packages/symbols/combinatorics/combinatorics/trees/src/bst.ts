// Binary search tree from successive insertion — the sylvester congruence map (permutation ->
// binary_tree).
//
// REPRESENTATION. `binary_tree`'s declared shape (carrier-data.ts) is `list<integer>`, flat —
// not the nested `leaf 0 / [L, R]` shape the collections package uses to GENERATE
// `BinaryTrees(n)` (packages/symbols/combinatorics/collections/src/families/kernels-extra.ts). Nothing in the repo yet
// constructs a `binary_tree` value, so there is no existing decoder to match; the flat shape
// is the constraint, and it also matches the worked example already staged for this carrier
// in scripts/collect-entries.ts's `SAMPLES` (`binary_tree: { contents: ["List", 1, 2, 3] }`).
//
// The encoding chosen here: a PARENT-POINTER array indexed by VALUE — entry v holds the value
// of v's parent in the tree, or 0 if v is the root.
//
// CONSTRUCTION. When v is inserted, it lands between its predecessor and successor among the
// values already placed (the nearest smaller and nearest larger), and hangs off whichever of
// the two was inserted later. No descent through the tree is simulated, so a parent costs two
// folds over the values and the whole array is quadratic in the size.

import { bind, forEach, positions, size, type MathJSON } from "../../src/map-helpers.ts";

/** Where value `value` sits in the word. */
const positionOf = (value: MathJSON): MathJSON => ["IndexOf", "_raw", value];

/** The nearest value to `v` on one side among those placed before it, or 0 if there is none.
 *  `values` runs toward `v` from that side's far end (ascending below, descending above), so
 *  the last match is the nearest. */
const nearest = (values: MathJSON, side: "Less" | "Greater"): MathJSON => [
  "Fold",
  ["Function", ["If", ["And", ["Less", positionOf("u"), "pv"], [side, "u", "v"]], "u", "near"], "near", "u"],
  0,
  values,
];

const ASCENDING: MathJSON = ["Range", 1, size, 1];
const DESCENDING: MathJSON = ["Range", size, 1, -1];

/** The finished parent-pointer array: every value's parent, 0 for the root. */
export const bstParents: MathJSON = forEach(
  positions,
  bind(
    "pv",
    positionOf("v"),
    bind(
      "below",
      nearest(ASCENDING, "Less"),
      bind("above", nearest(DESCENDING, "Greater"), [
        "If",
        ["Equal", "below", 0],
        "above",
        [
          "If",
          ["Equal", "above", 0],
          "below",
          ["If", ["Greater", positionOf("below"), positionOf("above")], "below", "above"],
        ],
      ]),
    ),
  ),
  "v",
);
