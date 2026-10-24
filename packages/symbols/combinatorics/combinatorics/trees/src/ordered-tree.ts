// An ordered (plane) tree as nested lists: a node is the list of its children, so `[]` is a single
// vertex. A forest is a list of trees, which makes it the same value as a tree (the root's children):
// the left- and right-branch bijections with binary trees below are each one recursion over a forest.
// Defined in Epsil by recursion (recursion.ts); findstat/tests/map-findstat-readings.ts reads them
// independently.
import { isLeaf, recurse, self } from "../../src/recursion.ts";

type MathJSON = unknown;

const empty = (forest: MathJSON): MathJSON => ["Equal", ["Length", forest], 0];
const first = (forest: MathJSON): MathJSON => ["At", forest, 1];
const last = (forest: MathJSON): MathJSON => ["At", forest, ["Length", forest]];
const withoutFirst = (forest: MathJSON): MathJSON => ["Drop", forest, 1];
const withoutLast = (forest: MathJSON): MathJSON => ["Take", forest, ["Subtract", ["Length", forest], 1]];
const left = (tree: MathJSON): MathJSON => ["At", tree, 1];
const right = (tree: MathJSON): MathJSON => ["At", tree, 2];

/** Mp00048: the children reversed, each subtree the same way. */
export const mirrorOrderedBody: MathJSON = recurse(
  [
    "If",
    empty("t"),
    ["List"],
    [
      "Map",
      ["Function", self("c"), "c"],
      [
        "Map",
        ["Function", ["At", "t", ["Subtract", ["Add", ["Length", "t"], 1], "k"]], "k"],
        ["Range", 1, ["Length", "t"], 1],
      ],
    ],
  ],
  ["t"],
  "_raw",
);

/** Mp00049: a forest's last tree is the root, its left binary child the rest of the forest and its right one its own children. */
export const leftBranchBinaryTreeBody: MathJSON = recurse(
  ["If", empty("f"), 0, ["List", self(withoutLast("f")), self(last("f"))]],
  ["f"],
  "_raw",
);

/** Mp00050: a forest's first tree is the root, its left binary child its own children and its right one the rest of the forest. */
export const rightBranchBinaryTreeBody: MathJSON = recurse(
  ["If", empty("f"), 0, ["List", self(first("f")), self(withoutFirst("f"))]],
  ["f"],
  "_raw",
);

/** Mp00010, the inverse of Mp00049: [L, R] is the forest of L's trees, then one more tree whose children are R's forest. */
export const leftBranchOrderedTreeBody: MathJSON = recurse(
  ["If", isLeaf("b"), ["List"], ["Join", self(left("b")), ["List", self(right("b"))]]],
  ["b"],
  "_raw",
);

/** Mp00015, the inverse of Mp00050: [L, R] is one tree whose children are L's forest, then the forest of R's trees. */
export const rightBranchOrderedTreeBody: MathJSON = recurse(
  ["If", isLeaf("b"), ["List"], ["Join", ["List", self(left("b"))], self(right("b"))]],
  ["b"],
  "_raw",
);

/** Mp00051: the first child's path inside an up and a down step, then the rest of the children's. */
export const dyckPathOfOrderedTreeBody: MathJSON = recurse(
  ["If", empty("f"), ["List"], ["Join", ["List", 1], self(first("f")), ["List", 0], self(withoutFirst("f"))]],
  ["f"],
  "_raw",
);

/** Mp00246: walk down the first-child spine, wrapping what is built so far with each node's other children. */
export const rotateOrderedBody: MathJSON = recurse(
  ["If", empty("s"), "r", self(first("s"), ["Join", withoutFirst("s"), ["List", "r"]])],
  ["s", "r"],
  "_raw",
  ["List"],
);
