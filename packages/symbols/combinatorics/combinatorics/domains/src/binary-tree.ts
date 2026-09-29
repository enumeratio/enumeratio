// A binary tree three ways: nested (`BinaryTree`: leaf 0, node [left, right], as the
// BinaryTrees collection lists them), as its in-order parent array (`BinaryTreeParentArray`:
// entry k holds the parent of the k-th node in order, 0 at the root, which is what
// `BinarySearchTreeParentArray` builds; see bst.ts), and as a Dyck path. Each conversion is
// defined in Epsil (below, by recursion; see recursion.ts), and compiled to a kernel: the
// collections family's own (`BinaryTreeParentArray`/`BinaryTreeOfParentArray` in
// ../../collections/src/families/kernels-extra.ts) behind a MathJSON encode/decode boundary.
import {
  BinaryTreeOfParentArray,
  BinaryTreeParentArray,
  type BinTree,
} from "../../collections/src/families/kernels-extra.ts";

import { isLeaf, recurse, self } from "./recursion.ts";

type Tree = BinTree;
type MathJSON = unknown;

const decodeTree = (json: MathJSON): Tree | undefined => {
  if (json === 0) return 0;
  if (!Array.isArray(json) || json[0] !== "List" || json.length !== 3) return undefined;
  const left = decodeTree(json[1]);
  const right = decodeTree(json[2]);
  return left === undefined || right === undefined ? undefined : [left, right];
};
const encodeTree = (tree: Tree): MathJSON => (tree === 0 ? 0 : ["List", encodeTree(tree[0]), encodeTree(tree[1])]);

const decodeInts = (json: MathJSON): number[] | undefined =>
  Array.isArray(json) && json[0] === "List" && json.slice(1).every((x) => Number.isInteger(x))
    ? (json.slice(1) as number[])
    : undefined;
const encodeInts = (values: readonly number[]): MathJSON => ["List", ...values];

export const parentArrayOf = BinaryTreeParentArray;

/** The tree an in-order parent array describes, or undefined when it describes none. */
export const treeOfParentArray = BinaryTreeOfParentArray;

/** φ([L, R]) = U φ(L) D φ(R), FindStat's Mp00012. BinaryTrees is ranked through it. */
export function dyckPathOf(tree: Tree): number[] {
  return tree === 0 ? [] : [1, ...dyckPathOf(tree[0]), 0, ...dyckPathOf(tree[1])];
}

export function treeOfDyckPath(word: readonly number[]): Tree | undefined {
  if (word.length === 0) return 0;
  if (word[0] !== 1) return undefined;
  let height = 0;
  for (let j = 0; j < word.length; j++) {
    height += word[j] === 1 ? 1 : word[j] === 0 ? -1 : Number.NaN;
    if (!(height >= 0)) return undefined;
    if (height === 0) {
      const left = treeOfDyckPath(word.slice(1, j));
      const right = treeOfDyckPath(word.slice(j + 1));
      return left === undefined || right === undefined ? undefined : [left, right];
    }
  }
  return undefined;
}

// The kernels a map runs over its subject's contents; undefined declines.
export const binaryTreeParentArrayKernel = (json: MathJSON): MathJSON => {
  const tree = decodeTree(json);
  return tree === undefined ? undefined : encodeInts(parentArrayOf(tree));
};
export const binaryTreeOfParentArrayKernel = (json: MathJSON): MathJSON => {
  const parents = decodeInts(json);
  const tree = parents === undefined ? undefined : treeOfParentArray(parents);
  return tree === undefined ? undefined : encodeTree(tree);
};
export const dyckPathKernel = (json: MathJSON): MathJSON => {
  const tree = decodeTree(json);
  return tree === undefined ? undefined : encodeInts(dyckPathOf(tree));
};
export const binaryTreeOfDyckPathKernel = (json: MathJSON): MathJSON => {
  const word = decodeInts(json);
  const tree = word === undefined ? undefined : treeOfDyckPath(word);
  return tree === undefined ? undefined : encodeTree(tree);
};

// The definitions, in Epsil. The kernels above are their compiled form, and
// tests/map-definitions.test.ts holds the two to the same answers.

const left = (tree: MathJSON): MathJSON => ["At", tree, 1];
const right = (tree: MathJSON): MathJSON => ["At", tree, 2];

/** Mp00012: [L, R] as U φ(L) D φ(R). */
export const dyckPathBody: MathJSON = recurse(
  ["If", isLeaf("t"), ["List"], ["Join", ["List", 1], self(left("t")), ["List", 0], self(right("t"))]],
  ["t"],
  "_raw",
);

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
          ["If", ["Equal", ["Add", ["At", "acc", 1], ["Subtract", ["Multiply", 2, ["At", "_raw", "j"]], 1]], 0], "j", 0],
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
      ["List", self(["Add", "a", 1], ["Subtract", firstReturn("a", "b"), 1]), self(["Add", firstReturn("a", "b"), 1], "b")],
    ],
  ],
  ["a", "b"],
  1,
  ["Length", "_raw"],
);

/** How many nodes a tree has. */
const sizeOf = (tree: MathJSON): MathJSON =>
  recurse(["If", isLeaf("t"), 0, ["Add", 1, self(left("t")), self(right("t"))]], ["t"], tree);

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

/** The child of `v` in `parents` on the side `side` picks (`Less` for left, `Greater` for right), or 0. */
const childOf = (parents: MathJSON, v: MathJSON, side: string): MathJSON => [
  "Fold",
  ["Function", ["If", ["And", ["Equal", ["At", parents, "c"], v], [side, "c", v]], "c", "found"], "found", "c"],
  0,
  ["Range", 1, ["Length", parents], 1],
];

/** The tree an in-order parent array describes, built down from its root. */
export const treeOfParentArrayBody: MathJSON = recurse(
  ["If", ["Equal", "v", 0], 0, ["List", self(childOf("_raw", "v", "Less")), self(childOf("_raw", "v", "Greater"))]],
  ["v"],
  childOf("_raw", 0, "Greater"),
);

/** Only an array that is some tree's in-order parent array converts. */
export const treeOfParentArrayGuard: MathJSON = ["Equal", parentArrayExpression("_image"), "_raw"];

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
