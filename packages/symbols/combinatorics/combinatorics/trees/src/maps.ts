// Combinatorial maps whose `from` carrier is `binary_tree` or `binary_tree_parent_array` (step
// 6c: maps carved into the area owning their source carrier). The one map FROM `dyck_path` TO
// `binary_tree` lives in `../../lattice-paths/src/maps.ts` instead — its `from` carrier is
// lattice-paths' own, even though it shares `binary-tree.ts`'s bodies with the maps here.

import type { CombinatorialMap } from "../../src/map-helpers.ts";
import { isLeaf } from "../../src/recursion.ts";
import {
  dyckPathBody,
  leftBorderSymmetryBody,
  mirrorBody,
  parentArrayBody,
  treeOfParentArrayBody,
  treeOfParentArrayGuard,
} from "./binary-tree.ts";

const left = (tree: unknown): unknown => ["At", tree, 1];
const right = (tree: unknown): unknown => ["At", tree, 2];

export const TREES_MAPS: readonly CombinatorialMap[] = [
  {
    name: "BinaryTreeParentArray",
    convert: true,
    from: "binary_tree",
    to: "binary_tree_parent_array",
    body: parentArrayBody,
    summary:
      "A binary tree as its parent array: its nodes numbered in order, entry k the number of the k-th node's parent, 0 at the root.",
    note: "An order isomorphism: the k-th tree BinaryTrees lists goes to the k-th array BinaryTreeParentArrays lists.",
  },
  {
    name: "BinaryTree",
    convert: true,
    from: "binary_tree_parent_array",
    to: "binary_tree",
    body: treeOfParentArrayBody,
    guard: treeOfParentArrayGuard,
    summary: "The binary tree an in-order parent array describes: a node below its parent goes left, above it right.",
    note: "Declines an array that isn't one: two roots, two left children, a cycle, or labels out of order.",
  },
  {
    name: "DyckPath",
    convert: true,
    from: "binary_tree",
    to: "dyck_path",
    body: dyckPathBody,
    summary: "A binary tree [L, R] as the Dyck path U φ(L) D φ(R).",
    note: "FindStat's Mp00012. A bijection, so every Dyck path statistic answers on a tree; not order-preserving between BinaryTrees and DyckPaths, which list in different orders.",
    findstat: ["Mp00012"],
  },
  {
    name: "Mirror",
    from: "binary_tree",
    to: "binary_tree",
    body: mirrorBody,
    summary: "The left-right symmetry of a binary tree: every node's two subtrees swapped.",
    note: "FindStat's Mp00016, an involution. Conjugated by the Dyck-path bijection it is DecompositionReverse.",
  },
  {
    name: "LeftRotation",
    from: "binary_tree",
    to: "binary_tree",
    // [A, [B, C]] becomes [[A, B], C]; with no right child to pull up, FindStat swaps the children.
    body: [
      "If",
      isLeaf("_raw"),
      0,
      [
        "If",
        isLeaf(right("_raw")),
        ["List", 0, left("_raw")],
        ["List", ["List", left("_raw"), left(right("_raw"))], right(right("_raw"))],
      ],
    ],
    summary: "Rotate the root to the left: the right child becomes the root, the root its left child.",
    note: "FindStat's Mp00009. A tree whose root has no right child has nothing to rotate; FindStat then moves its left subtree to the right, as [., A], and so do we. That makes it a bijection on every size, inverse to RightRotation.",
  },
  {
    name: "RightRotation",
    from: "binary_tree",
    to: "binary_tree",
    // [[A, B], C] becomes [A, [B, C]]; with no left child to pull up, FindStat swaps the children.
    body: [
      "If",
      isLeaf("_raw"),
      0,
      [
        "If",
        isLeaf(left("_raw")),
        ["List", right("_raw"), 0],
        ["List", left(left("_raw")), ["List", right(left("_raw")), right("_raw")]],
      ],
    ],
    summary: "Rotate the root to the right: the left child becomes the root, the root its right child.",
    note: "FindStat's Mp00019. A tree whose root has no left child has nothing to rotate; FindStat then moves its right subtree to the left, as [A, .], and so do we. That makes it a bijection on every size, inverse to LeftRotation.",
  },
  {
    name: "LeftBorderSymmetry",
    from: "binary_tree",
    to: "binary_tree",
    body: leftBorderSymmetryBody,
    summary:
      "Reverse the order of the right subtrees hanging off the left border, applying the same symmetry inside each.",
    note: "FindStat's Mp00018, an involution.",
  },
];
