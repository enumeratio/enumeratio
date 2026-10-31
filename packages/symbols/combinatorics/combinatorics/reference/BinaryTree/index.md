---
name: BinaryTree
domain: Collections
signature: BinaryTree(tree)
catalogCarrier: true
glyph: nested-tree
summary: "The singular-inhabitant constructor for a binary tree, nested: a leaf is 0, a node [left, right]."
references:
  - system: wikipedia
    identity: Binary tree
signatures:
  - call: BinaryTree(tree)
    description: "The singular-inhabitant constructor for a binary tree, nested: a leaf is 0, a node [left, right]."
    library: enumeratio-combinatorics
    type: ((integer | list<any>) -> binary_tree) & ((binary_tree_parent_array) -> binary_tree) & ((ordered_tree) -> binary_tree) & ((dyck_path) -> binary_tree)
seeAlso:
  - BinaryTrees
  - BinaryTreeParentArray
  - DyckPath
laws:
  - inverse: BinaryTreeParentArray
    on: binary_tree_parent_array
  - orderIsomorphism:
      from: BinaryTreeParentArrays
      to: BinaryTrees
    on: binary_tree_parent_array
  - inverse: DyckPath
    on: dyck_path
  - graded:
      from: DyckPaths
      to: BinaryTrees
    on: dyck_path
  - inverse: OrderedTree
    on: ordered_tree
  - graded:
      from: OrderedTrees
      to: BinaryTrees
    on: ordered_tree
catalog:
  - system: findstat
    identity: Mp00034
    url: https://www.findstat.org/Mp00034
    on: DyckPath
  - system: findstat
    identity: Mp00049
    url: https://www.findstat.org/Mp00049
    on: OrderedTree
---

- `BinaryTree([[0, 0], 0])` is a root whose left child is a single node. The empty tree is `BinaryTree(0)`.
- The same structure as a Dyck path, U φ(L) D φ(R) (`DyckPath(tree)`, FindStat's Mp00012), and as its in-order parent array (`BinaryTreeParentArray(tree)`); `BinaryTree` of either converts back. Both are bijections, so every Dyck path statistic answers on a tree. The parent arrays also keep [[BinaryTrees]]' order.
- `BinaryTree` of an ordered tree is FindStat's Mp00049 (a vertex's left brother becomes its left child, its last child the right one, and the root goes). `RightBranchBinaryTree` is the same with left and right exchanged (Mp00050).
