// IncreasingBinaryTrees in Epsil: the binary trees on the labels 1..n that are heap ordered (a
// node's label is below its children's), as nested lists (a leaf 0, a node [label, left, right]), in
// the order of their in-order label sequences, which are the permutations of n in lex order
// (SymmetricGroup). Unrank builds the Cartesian tree of the permutation; rank and membership read
// the labels back in order (./nested.ts).

import { symmetricGroup } from "../../../permutations/src/families/core.ts";
import type { EpsilFamily } from "./epsil.ts";
import { ANY, isInteger, put, zeros } from "./nested.ts";
import { add, and, at, equal, fold, iff, less, lets, mul, sub, upTo } from "./tables.ts";

type MathJSON = unknown;

const N = "_n";

/**
 * The Cartesian tree of the bound permutation `perm` of n: the smallest entry is the root, the
 * entries either side of it its subtrees, by the same rule. T(lo, hi) for each interval of
 * positions, shortest first, in a flat list (an empty interval is a leaf, 0, and stays so).
 */
const cartesianTree = (perm: string): MathJSON => {
  const cell = (lo: MathJSON, hi: MathJSON): MathJSON => add(mul(sub(lo, 1), add(N, 1)), hi, 1);
  const hi = sub(add("co", "cl"), 1);
  const smallest = fold(
    iff(less(at(perm, "cx"), at(perm, "cb")), "cx", "cb"),
    "cb",
    "cx",
    "co",
    upTo(add("co", 1), hi),
  );
  const tree = fold(
    fold(
      lets(
        [
          ["ct", "ci", ANY],
          ["cm", smallest, "integer"],
        ],
        put("ci", [
          cell("co", hi),
          ["List", at(perm, "cm"), at("ct", cell("co", sub("cm", 1))), at("ct", cell(add("cm", 1), hi))],
        ]),
      ),
      "ci",
      "co",
      "cs",
      upTo(1, add(sub(N, "cl"), 1)),
    ),
    "cs",
    "cl",
    zeros(mul(add(N, 1), add(N, 1))),
    upTo(1, N),
  );
  return at(tree, cell(1, N));
};

/**
 * The lex rank of the bound permutation `perm` of n, as SymmetricGroup ranks it: digit j is the
 * number of values below entry j not used before it, read in Horner form. The count is bound before
 * it is subtracted: compute-engine leaves a fold over a bound list unevaluated inside a difference.
 */
const lexRank = (perm: string): MathJSON =>
  fold(
    lets(
      [
        [
          "lb",
          fold(add("lc", iff(less(at(perm, "li"), at(perm, "lj")), 1, 0)), "lc", "li", 0, upTo(1, sub("lj", 1))),
          "integer",
        ],
      ],
      add(mul("lr", add(sub(N, "lj"), 1)), sub(sub(at(perm, "lj"), 1), "lb")),
    ),
    "lr",
    "lj",
    0,
    upTo(1, N),
  );

/**
 * The labels of the nested tree `tree` in order, read as the walk of a stack of items: a subtree to
 * open, with the label of its parent as the bound a label must clear (kind 1), or a label to write
 * (kind 2). Opening a node checks its shape and label (an integer in 1..n not seen, above the
 * bound) and replaces it by its right subtree, its label and its left subtree, the left on top.
 * State: [height, labels written, bad, seen flags 1..n, the labels, the kinds, the cells, the
 * bounds]; the walk is sound when it ends at height 0 with n labels written and bad 0.
 */
const readLabels = (tree: MathJSON): MathJSON => {
  const room = add(mul(2, N), 3);
  const seenAt = (v: MathJSON): MathJSON => add(3, v);
  const labelAt = (s: MathJSON): MathJSON => add(3, N, s);
  const kindAt = (c: MathJSON): MathJSON => add(3, mul(2, N), c);
  const cellAt = (c: MathJSON): MathJSON => add(3, mul(2, N), room, c);
  const boundAt = (c: MathJSON): MathJSON => add(3, mul(2, N), mul(2, room), c);
  const height = at("ft", 1);
  const written = at("ft", 2);
  const item = at("ft", cellAt(height));
  const label = at(item, 1);
  const fail = put("ft", [1, sub(height, 1)], [3, 1]);
  const open = put(
    "ft",
    [seenAt(label), 1],
    [cellAt(height), at(item, 3)],
    [kindAt(height), 1],
    [boundAt(height), label],
    [cellAt(add(height, 1)), label],
    [kindAt(add(height, 1)), 2],
    [cellAt(add(height, 2)), at(item, 2)],
    [kindAt(add(height, 2)), 1],
    [boundAt(add(height, 2)), label],
    [1, add(height, 2)],
  );
  // The checks run in turn: an integer label comes only after the node has three entries.
  const node = iff(
    ["NotEqual", ["Length", item], 3],
    fail,
    iff(
      ["Not", isInteger(label)],
      fail,
      iff(
        ["Or", less(label, 1), ["Greater", label, N]],
        fail,
        iff(
          ["NotEqual", at("ft", seenAt(label)), 0],
          fail,
          iff(
            ["LessEqual", label, at("ft", boundAt(height))],
            fail,
            iff(["Greater", add(height, 2), room], fail, open),
          ),
        ),
      ),
    ),
  );
  return fold(
    lets(
      [["ft", "fs", ANY]],
      iff(
        equal(height, 0),
        "ft",
        iff(
          equal(at("ft", kindAt(height)), 2),
          put("ft", [1, sub(height, 1)], [2, add(written, 1)], [labelAt(add(written, 1)), item]),
          iff(isInteger(item), put("ft", [1, sub(height, 1)], [3, iff(equal(item, 0), at("ft", 3), 1)]), node),
        ),
      ),
    ),
    "fs",
    "fj",
    [
      "Join",
      ["List", 1, 0, 0],
      zeros(mul(2, N)),
      ["List", 1],
      zeros(sub(room, 1)),
      ["List", tree],
      zeros(sub(room, 1)),
      zeros(room),
    ],
    upTo(1, add(mul(3, N), 1)),
  );
};

export const increasingBinaryTrees: EpsilFamily = {
  head: "IncreasingBinaryTrees",
  carrier: "IncreasingBinaryTree",
  paramCount: 1,
  kind: "nested",
  params: [N],
  // The count is n!, exact in the interpreter, but the stack walks take seconds a call past 2^53.
  declinePastDoubles: true,
  epsil: {
    count: symmetricGroup.epsil.count,
    unrank: lets([["ip", symmetricGroup.epsil.unrank, "list<integer>"]], cartesianTree("ip")),
    rank: lets(
      [
        ["ir", readLabels("_x"), ANY],
        // Filled in place: the interpreter keeps a mapped or sliced list lazy, and the rank reads it many times.
        ["ip", fold(put("ia", ["ik", at("ir", add(3, N, "ik"))]), "ia", "ik", zeros(N), upTo(1, N)), "list<integer>"],
      ],
      lexRank("ip"),
    ),
    valid: lets(
      [["ir", readLabels("_x"), ANY]],
      and(equal(at("ir", 1), 0), equal(at("ir", 2), N), equal(at("ir", 3), 0)),
    ),
  },
};
