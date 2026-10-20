// IncreasingBinaryTrees in Epsil: the binary trees on the labels 1..n that are heap ordered (a
// node's label is below its children's), as nested lists (a leaf 0, a node [label, left, right]), in
// the order of their in-order label sequences, which are the permutations of n in lex order
// (SymmetricGroup). Unrank builds the Cartesian tree of the permutation. Rank and membership work on
// the tree flattened (its preorder, a 0 per empty subtree), in flat lists: the interpreter is far
// slower on a state that holds a nested tree.

import { symmetricGroup } from "../../../permutations/src/families/core.ts";
import type { EpsilFamily } from "./epsil.ts";
import { ANY, isInteger, put, zeros } from "./nested.ts";
import { add, at, equal, fold, iff, less, lets, mul, sub, upTo } from "./tables.ts";

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

const TOKENS = add(mul(2, N), 1);
const flatten = (x: MathJSON): MathJSON => ["Flatten", ["List", x]];

/**
 * The labels of a tree in order, on flat lists. The tree flattened (`tokens`) is its preorder with a
 * 0 for each empty subtree, 2n + 1 entries; read in order, a label is pushed on a stack and each 0
 * pops the label whose left subtree it ends, which comes next in order. State: [height, labels
 * written, the stack, the labels]; an entry that isn't an integer reads as -1.
 */
const readLabels = (tokens: string): MathJSON => {
  const stackAt = (h: MathJSON): MathJSON => add(2, h);
  const labelAt = (w: MathJSON): MathJSON => add(2, TOKENS, w);
  const height = at("ft", 1);
  const written = at("ft", 2);
  const token = at(tokens, "fj");
  return fold(
    lets(
      [["fe", iff(isInteger(token), token, -1), "integer"]],
      iff(
        equal("fe", 0),
        iff(
          less(0, height),
          put("ft", [1, sub(height, 1)], [2, add(written, 1)], [labelAt(add(written, 1)), at("ft", stackAt(height))]),
          "ft",
        ),
        put("ft", [1, add(height, 1)], [stackAt(add(height, 1)), "fe"]),
      ),
    ),
    "ft",
    "fj",
    zeros(add(2, mul(2, TOKENS))),
    upTo(1, TOKENS),
  );
};

/** The first n labels read, filled in place: the interpreter keeps a sliced list lazy. */
const permutationRead = (state: string): MathJSON =>
  fold(put("ia", ["ik", at(state, add(2, TOKENS, "ik"))]), "ia", "ik", zeros(N), upTo(1, N));

/**
 * Whether the n labels on the flattened tree `tokens` are distinct integers in 1..n, each above its
 * parent's: the preorder is read with a stack of the slots still to fill, each holding the label of
 * the node it belongs to (0 above the root). A label fills the top slot and opens two, its own; a 0
 * fills it and opens none. State: [bad, height, the slots, the labels seen].
 */
const heapOrdered = (tokens: string): MathJSON => {
  const slots = add(TOKENS, 2);
  const stackAt = (h: MathJSON): MathJSON => add(2, h);
  const seenAt = (v: MathJSON): MathJSON => add(2, slots, v);
  const bad = at("ht", 1);
  const height = at("ht", 2);
  const token = at(tokens, "hj");
  const fail = put("ht", [1, 1]);
  const open = put(
    "ht",
    [seenAt("he"), 1],
    [stackAt(height), "he"],
    [stackAt(add(height, 1)), "he"],
    [2, add(height, 1)],
  );
  const state = fold(
    lets(
      [["he", iff(isInteger(token), token, -1), "integer"]],
      iff(
        ["NotEqual", bad, 0],
        "ht",
        iff(
          equal(height, 0),
          fail,
          iff(
            equal("he", 0),
            put("ht", [2, sub(height, 1)]),
            iff(
              ["Not", ["Greater", "he", at("ht", stackAt(height))]],
              fail,
              iff(["Greater", "he", N], fail, iff(["NotEqual", at("ht", seenAt("he")), 0], fail, open)),
            ),
          ),
        ),
      ),
    ),
    "ht",
    "hj",
    ["Join", ["List", 0, 1], zeros(add(slots, N))],
    upTo(1, TOKENS),
  );
  return lets([["hs", state, "list<integer>"]], ["And", equal(at("hs", 1), 0), equal(at("hs", 2), 0)]);
};

/**
 * Whether the nested `tree` is made of nodes alone: a node a list of three, an integer label then
 * two subtrees, each a node or a leaf 0. Read a level at a time, as a list of the nodes at it (the
 * subtrees of the nodes above, spliced); a bad node leaves [[-1]] in their place, which no later
 * level accepts, and the walk is sound when the last level, past the deepest a tree of n nodes
 * reaches, is empty.
 */
const nodesOnly = (tree: MathJSON): MathJSON => {
  const entry = (k: number): MathJSON => at("fn", k);
  const slot = (k: number): MathJSON => iff(isInteger(entry(k)), equal(entry(k), 0), "True");
  const bad = lets(
    [["fn", at("fl", "fi"), ANY]],
    iff(
      equal(["Length", "fn"], 3),
      iff(isInteger(entry(1)), iff(equal(entry(1), 0), 1, iff(slot(2), iff(slot(3), 0, 1), 1)), 1),
      1,
    ),
  );
  const level = fold(
    lets(
      [["fl", "fs", ANY]],
      lets(
        [["fb", fold(add("fa", bad), "fa", "fi", 0, upTo(1, ["Length", "fl"])), "integer"]],
        iff(
          equal("fb", 0),
          ["Filter", ["Flatten", "fl", 1], ["Function", ["Not", ["Element", "fe", "Numbers"]], "fe"]],
          ["List", ["List", -1]],
        ),
      ),
    ),
    "fs",
    "fk",
    iff(["Element", tree, "Numbers"], ["List"], ["List", tree]),
    upTo(1, add(N, 1)),
  );
  return lets([["fz", level, ANY]], equal(["Length", "fz"], 0));
};

export const increasingBinaryTrees: EpsilFamily = {
  head: "IncreasingBinaryTrees",
  carrier: "IncreasingBinaryTree",
  paramCount: 1,
  kind: "nested",
  params: [N],
  // The count is n!, exact in the interpreter, but the walks take seconds a call past 2^53.
  declinePastDoubles: true,
  epsil: {
    count: symmetricGroup.epsil.count,
    unrank: lets([["ip", symmetricGroup.epsil.unrank, "list<integer>"]], cartesianTree("ip")),
    // Only a tree of 2n + 1 entries flattened can be read, a member's rank among them.
    rank: lets(
      [["it", flatten("_x"), ANY]],
      iff(
        ["NotEqual", ["Length", "it"], TOKENS],
        -1,
        lets(
          [
            ["ir", readLabels("it"), "list<integer>"],
            ["ip", permutationRead("ir"), "list<integer>"],
          ],
          lexRank("ip"),
        ),
      ),
    ),
    valid: lets(
      [["it", flatten("_x"), ANY]],
      iff(["NotEqual", ["Length", "it"], TOKENS], "False", iff(heapOrdered("it"), nodesOnly("_x"), "False")),
    ),
  },
};
