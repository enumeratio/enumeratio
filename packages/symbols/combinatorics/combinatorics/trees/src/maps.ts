// Combinatorial maps whose `from` carrier is `binary_tree` or `binary_tree_parent_array` (step
// 6c: maps carved into the area owning their source carrier). The one map FROM `dyck_path` TO
// `binary_tree` lives in `../../lattice-paths/src/maps.ts` instead — its `from` carrier is
// lattice-paths' own, even though it shares `binary-tree.ts`'s bodies with the maps here.

import type { CombinatorialMap } from "../../src/map-helpers.ts";
import { dyckPathBody, parentArrayBody, treeOfParentArrayBody, treeOfParentArrayGuard } from "./binary-tree.ts";

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
    laws: [{ inverse: "BinaryTree" }],
    orderIsomorphism: { from: "BinaryTrees", to: "BinaryTreeParentArrays" },
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
    laws: [{ inverse: "BinaryTreeParentArray" }],
    orderIsomorphism: { from: "BinaryTreeParentArrays", to: "BinaryTrees" },
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
    laws: [{ inverse: "BinaryTree" }],
  },
];
