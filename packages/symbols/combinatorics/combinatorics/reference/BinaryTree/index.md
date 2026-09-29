---
name: BinaryTree
domain: Collections
signature: BinaryTree(tree)
catalogCarrier: true
summary: "The singular-inhabitant constructor for a binary tree, nested: a leaf is 0, a node [left, right]."
references:
  - system: wikipedia
    identity: Binary tree
signatures:
  - call: BinaryTree(tree)
    description: "The singular-inhabitant constructor for a binary tree, nested: a leaf is 0, a node [left, right]."
    library: enumeratio-combinatorics
    type: ((integer | list<any>) -> binary_tree) & ((binary_tree_parent_array) -> binary_tree) & ((dyck_path) -> binary_tree)
seeAlso:
  - BinaryTrees
  - BinaryTreeParentArray
  - DyckPath
---

- `BinaryTree([[0, 0], 0])` is a root whose left child is a single node. The empty tree is `BinaryTree(0)`.
- The same structure as a Dyck path, U φ(L) D φ(R) (`DyckPath(tree)`, FindStat's Mp00012), and as its in-order parent array (`BinaryTreeParentArray(tree)`); `BinaryTree` of either converts back. Both are bijections, so every Dyck path statistic answers on a tree. The parent arrays also keep [[BinaryTrees]]' order.
