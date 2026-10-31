// A binary tree three ways: nested (`BinaryTree`: leaf 0, node [left, right], as the
// BinaryTrees collection lists them), as its in-order parent array (`BinaryTreeParentArray`:
// entry k holds the parent of the k-th node in order, 0 at the root, which is what
// `BinarySearchTreeParentArray` builds; see bst.ts), and as a Dyck path. The conversions are
// defined in Epsil, by recursion (recursion.ts); tests/map-definitions.test.ts checks them
// against an independent TypeScript reading.
import { buildFromWord, put, zeros } from "../../collections/src/families/nested.ts";
import { add, at, equal, fold, iff, lets, map, mul, sub, upTo } from "../../collections/src/families/tables.ts";
import { isLeaf, recurse, self } from "../../src/recursion.ts";

type MathJSON = unknown;

const take = (list: MathJSON, count: MathJSON): MathJSON => ["Take", list, count];
const drop = (list: MathJSON, count: MathJSON): MathJSON => ["Drop", list, count];

const left = (tree: MathJSON): MathJSON => ["At", tree, 1];
const right = (tree: MathJSON): MathJSON => ["At", tree, 2];

/** Mp00016: every node's subtrees swapped. */
export const mirrorOf = (tree: MathJSON): MathJSON =>
  recurse(["If", isLeaf("t"), 0, ["List", self(right("t")), self(left("t"))]], ["t"], tree);
export const mirrorBody: MathJSON = mirrorOf("_raw");

/** Mp00018: the right subtrees along the left border, in reverse order, each recursively the same.
 *  Walking down the border, each right subtree R is wrapped as [built so far, φ(R)], so the first
 *  (top) one ends deepest. */
export const leftBorderSymmetryBody: MathJSON = recurse(
  ["If", isLeaf("t"), "acc", self(left("t"), ["List", "acc", self(right("t"), 0)])],
  ["t", "acc"],
  "_raw",
  0,
);

/** Mp00012: [L, R] as U φ(L) D φ(R). */
export const dyckPathOf = (tree: MathJSON): MathJSON =>
  recurse(
    ["If", isLeaf("t"), ["List"], ["Join", ["List", 1], self(left("t")), ["List", 0], self(right("t"))]],
    ["t"],
    tree,
  );
export const dyckPathBody: MathJSON = dyckPathOf("_raw");

/** Where the Dyck word `_raw`, read from position `from`, first returns to height 0, or 0. */
const firstReturn = (from: MathJSON, to: MathJSON): MathJSON => [
  "At",
  [
    "Fold",
    [
      "Function",
      [
        "If",
        ["Greater", ["At", "acc", 2], 0],
        "acc",
        [
          "List",
          ["Add", ["At", "acc", 1], ["Subtract", ["Multiply", 2, ["At", "_raw", "j"]], 1]],
          [
            "If",
            ["Equal", ["Add", ["At", "acc", 1], ["Subtract", ["Multiply", 2, ["At", "_raw", "j"]], 1]], 0],
            "j",
            0,
          ],
        ],
      ],
      "acc",
      "j",
    ],
    ["List", 0, 0],
    ["Range", from, to, 1],
  ],
  2,
];

/** Mp00012's inverse over positions `a`..`b` of the word: U A D B, cut at its first return r, as
 *  [φ⁻¹(A), φ⁻¹(B)]. Positions, not sub-words, so each step passes integers. */
export const treeOfDyckPathBody: MathJSON = recurse(
  [
    "If",
    ["Greater", "a", "b"],
    0,
    // A word that never returns isn't a Dyck path: a leaf here, which the guard then rejects.
    [
      "If",
      ["Equal", firstReturn("a", "b"), 0],
      0,
      [
        "List",
        self(["Add", "a", 1], ["Subtract", firstReturn("a", "b"), 1]),
        self(["Add", firstReturn("a", "b"), 1], "b"),
      ],
    ],
  ],
  ["a", "b"],
  1,
  ["Length", "_raw"],
);

/** How many nodes a tree has: one fewer than its leaves, which `Flatten` counts at once. */
const sizeOf = (tree: MathJSON): MathJSON => ["Subtract", ["Length", ["Flatten", ["List", tree]]], 1];

/** The number the root of `tree` gets when its nodes are numbered from `offset` + 1. */
const rootOf = (tree: MathJSON, offset: MathJSON): MathJSON => ["Add", offset, sizeOf(left(tree)), 1];

/** A tree's in-order parent array: its nodes numbered from `offset` + 1, the root's parent `parent`. */
const parentArrayExpression = (tree: MathJSON): MathJSON =>
  recurse(
    [
      "If",
      isLeaf("t"),
      ["List"],
      [
        "Join",
        self(left("t"), "offset", rootOf("t", "offset")),
        ["List", "parent"],
        self(right("t"), rootOf("t", "offset"), rootOf("t", "offset")),
      ],
    ],
    ["t", "offset", "parent"],
    tree,
    0,
    0,
  );

export const parentArrayBody: MathJSON = parentArrayExpression("_raw");

const parentCount: MathJSON = ["Length", "_raw"];

/** The child of `v` in the array on the side `side` picks (`Less` for left, `Greater` for right), or 0. */
const childOf = (v: MathJSON, side: string): MathJSON =>
  fold(
    ["If", ["And", ["Equal", at("_raw", "pc"), v], [side, "pc", v]], "pc", "pf"],
    "pf",
    "pc",
    0,
    upTo(1, parentCount),
  );

/** `body` with the left and right child of every node, and the root, bound from the flat array; the tree is walked
 *  through them by an explicit stack, so nothing recurses. */
const withChildren = (body: MathJSON): MathJSON =>
  lets(
    [
      ["pl", map(childOf("pk", "Less"), "pk", upTo(1, parentCount)), "list<integer>"],
      ["pr", map(childOf("pk", "Greater"), "pk", upTo(1, parentCount)), "list<integer>"],
      ["proot", childOf(0, "Greater"), "integer"],
    ],
    body,
  );

/** The tree an in-order parent array describes, built from its preorder arity word: a stack walk from the root
 *  writes the word (a node 2, a missing child 0), and the word is read back from its end into the tree. State:
 *  [height, words written, the word's slots, the stack's cells]. */
export const treeOfParentArrayBody: MathJSON = withChildren(
  lets(
    [["plen", add(mul(2, parentCount), 1), "integer"]],
    lets(
      [
        [
          "pword",
          take(
            drop(
              fold(
                lets(
                  [
                    ["pw", "ps", "list<integer>"],
                    ["pid", at("pw", add("plen", 2, at("pw", 1))), "integer"],
                  ],
                  iff(
                    equal("pid", 0),
                    put("pw", [1, sub(at("pw", 1), 1)], [2, add(at("pw", 2), 1)], [add(at("pw", 2), 3), 0]),
                    put(
                      "pw",
                      [1, add(at("pw", 1), 1)],
                      [2, add(at("pw", 2), 1)],
                      [add(at("pw", 2), 3), 2],
                      [add("plen", 2, at("pw", 1)), at("pr", "pid")],
                      [add("plen", 3, at("pw", 1)), at("pl", "pid")],
                    ),
                  ),
                ),
                "ps",
                "pj",
                ["Join", ["List", 1, 0], zeros("plen"), ["List", "proot"], zeros(add(parentCount, 2))],
                upTo(1, "plen"),
              ),
              2,
            ),
            "plen",
          ),
          "list<integer>",
        ],
      ],
      buildFromWord("pword", "plen", 0),
    ),
  ),
);

/** Only an array that is some tree's in-order parent array converts: walked in order from the root through the
 *  children it names, every node comes up once and as the next number. A node a second child or a cycle leaves out
 *  isn't reached; a second root isn't either. State: [height, nodes visited, out of order, the node to open, the
 *  stack's cells]. */
export const treeOfParentArrayGuard: MathJSON = withChildren(
  lets(
    [
      [
        "pwalk",
        fold(
          lets(
            [["iw", "is", "list<integer>"]],
            iff(
              ["Not", equal(at("iw", 4), 0)],
              put("iw", [1, add(at("iw", 1), 1)], [4, at("pl", at("iw", 4))], [add(at("iw", 1), 5), at("iw", 4)]),
              iff(
                ["Greater", at("iw", 1), 0],
                lets(
                  [["ix", at("iw", add(at("iw", 1), 4)), "integer"]],
                  put(
                    "iw",
                    [1, sub(at("iw", 1), 1)],
                    [2, add(at("iw", 2), 1)],
                    [3, iff(equal("ix", add(at("iw", 2), 1)), at("iw", 3), 1)],
                    [4, at("pr", "ix")],
                  ),
                ),
                "iw",
              ),
            ),
          ),
          "is",
          "ij",
          ["Join", ["List", 0, 0, 0, "proot"], zeros(add(parentCount, 1))],
          upTo(1, mul(2, parentCount)),
        ),
        "list<integer>",
      ],
    ],
    ["And", equal(at("pwalk", 2), parentCount), equal(at("pwalk", 3), 0)],
  ),
);

/** Only a Dyck path converts: the tree must give back the word. */
export const treeOfDyckPathGuard: MathJSON = [
  "Equal",
  recurse(
    ["If", isLeaf("t"), ["List"], ["Join", ["List", 1], self(left("t")), ["List", 0], self(right("t"))]],
    ["t"],
    "_image",
  ),
  "_raw",
];
