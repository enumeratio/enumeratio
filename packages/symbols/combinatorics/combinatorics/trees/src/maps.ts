// Combinatorial maps whose `from` carrier is `binary_tree`, `binary_tree_parent_array` or `ordered_tree`
// (step 6c: maps carved into the area owning their source carrier). The one map FROM `dyck_path` TO
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
import {
  dyckPathOfOrderedTreeBody,
  leftBranchBinaryTreeBody,
  leftBranchOrderedTreeBody,
  mirrorOrderedBody,
  rightBranchBinaryTreeBody,
  rightBranchOrderedTreeBody,
  rotateOrderedBody,
} from "./ordered-tree.ts";

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
  {
    name: "OrderedTree",
    convert: true,
    from: "binary_tree",
    to: "ordered_tree",
    body: leftBranchOrderedTreeBody,
    summary:
      "A binary tree as an ordered tree with one more vertex: a left child becomes its parent's left brother, a right child its parent's last child.",
    note: "FindStat's Mp00010, Sage's to_ordered_tree_left_branch, a bijection from the binary trees with n nodes to the ordered trees with n edges. The inverse is BinaryTree(OrderedTree); RightBranchOrderedTree is the same with the roles of left and right exchanged.",
    findstat: ["Mp00010"],
  },
  {
    name: "RightBranchOrderedTree",
    from: "binary_tree",
    to: "ordered_tree",
    body: rightBranchOrderedTreeBody,
    summary:
      "A binary tree as an ordered tree with one more vertex: a right child becomes its parent's right brother, a left child its parent's first child.",
    note: "FindStat's Mp00015, Sage's to_ordered_tree_right_branch, a bijection. Its inverse is RightBranchBinaryTree. OrderedTree(BinaryTree) is the left-branch bijection, which is the constructor.",
  },
  {
    name: "Mirror",
    from: "ordered_tree",
    to: "ordered_tree",
    body: mirrorOrderedBody,
    summary: "The left-right symmetry of an ordered tree: every node's children in the opposite order.",
    note: "FindStat's Mp00048, an involution.",
  },
  {
    name: "BinaryTree",
    convert: true,
    from: "ordered_tree",
    to: "binary_tree",
    body: leftBranchBinaryTreeBody,
    summary:
      "An ordered tree as a binary tree with one fewer node: a vertex's left brother becomes its left child, its last child its right child, and the root goes.",
    note: "FindStat's Mp00049, Sage's to_binary_tree_left_branch, the inverse of OrderedTree(BinaryTree). RightBranchBinaryTree is the same with the roles of left and right exchanged.",
    findstat: ["Mp00049"],
  },
  {
    name: "RightBranchBinaryTree",
    from: "ordered_tree",
    to: "binary_tree",
    body: rightBranchBinaryTreeBody,
    summary:
      "An ordered tree as a binary tree with one fewer node: a vertex's right brother becomes its right child, its first child its left child, and the root goes.",
    note: "FindStat's Mp00050, Sage's to_binary_tree_right_branch, the inverse of RightBranchOrderedTree. BinaryTree(OrderedTree) is the left-branch bijection, which is the constructor.",
  },
  {
    name: "DyckPath",
    convert: true,
    from: "ordered_tree",
    to: "dyck_path",
    body: dyckPathOfOrderedTreeBody,
    summary:
      "An ordered tree as the Dyck path of its depth-first contour: an up step into each child, a down step out.",
    note: "FindStat's Mp00051. The inverse of OrderedTree(DyckPath).",
    findstat: ["Mp00051"],
  },
  {
    name: "Rotation",
    from: "ordered_tree",
    to: "ordered_tree",
    body: rotateOrderedBody,
    summary: "Attach a leaf to the root, remove the leftmost leaf, and let the vertex it hung from become the root.",
    note: "FindStat's Mp00246, a bijection corresponding to rotating a polygon dissection.",
  },
  {
    name: "DeBruijnMorselt",
    from: "ordered_tree",
    to: "ordered_tree",
    composedOf: ["OrderedTree", "RightBranchBinaryTree"],
    summary:
      "The right-branch bijection to binary trees followed by the left-branch bijection back: the de Bruijn-Morselt automorphism of the ordered trees.",
    note: "FindStat's Mp00328. Chaotic in general: Shapiro shows its sixth power is the identity on the trees that correspond to compositions.",
  },
  {
    name: "TamariDyckPath",
    from: "binary_tree",
    to: "dyck_path",
    composedOf: ["ReverseComplement", "DyckPath", "Mirror"],
    summary:
      "The Dyck path T(L) U T(R) D of a tree with subtrees L and R: the bijection compatible with the Tamari order.",
    note: "FindStat's Mp00020; the inverse is TamariBinaryTree. DyckPath(BinaryTree) reads the other decomposition, U T(L) D T(R), so this is it after a left-right mirror and a reverse-complement.",
  },
];
