---
name: RightBranchBinaryTree
domain: Combinatorial maps
signature: RightBranchBinaryTree(OrderedTree)
summary: "An ordered tree as a binary tree with one fewer node: a vertex's right brother becomes its right child, its first child its left child, and the root goes."
catalog:
  - system: findstat
    identity: Mp00050
    url: https://www.findstat.org/Mp00050
    on: OrderedTree
mapOn:
  - OrderedTree
laws:
  - inverse: RightBranchOrderedTree
  - graded:
      from: OrderedTrees
      to: BinaryTrees
    on: ordered_tree
signatures:
  - call: RightBranchBinaryTree(OrderedTree)
    description: "An ordered tree as a binary tree with one fewer node: a vertex's right brother becomes its right child, its first child its left child, and the root goes."
    library: enumeratio-combinatorics
    type: (ordered_tree) -> binary_tree
---

- Takes a `OrderedTree` and returns a `BinaryTree` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00050, Sage's to_binary_tree_right_branch, the inverse of RightBranchOrderedTree. BinaryTree(OrderedTree) is the left-branch bijection, which is the constructor.
