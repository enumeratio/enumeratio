---
name: RightBranchOrderedTree
domain: Combinatorial maps
signature: RightBranchOrderedTree(BinaryTree)
summary: "A binary tree as an ordered tree with one more vertex: a right child becomes its parent's right brother, a left child its parent's first child."
catalog:
  - system: findstat
    identity: Mp00015
    url: https://www.findstat.org/Mp00015
    on: BinaryTree
mapOn:
  - BinaryTree
laws:
  - inverse: RightBranchBinaryTree
  - graded:
      from: BinaryTrees
      to: OrderedTrees
    on: binary_tree
signatures:
  - call: RightBranchOrderedTree(BinaryTree)
    description: "A binary tree as an ordered tree with one more vertex: a right child becomes its parent's right brother, a left child its parent's first child."
    library: enumeratio-combinatorics
    type: (binary_tree) -> ordered_tree
---

- Takes a `BinaryTree` and returns a `OrderedTree` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00015, Sage's to_ordered_tree_right_branch, a bijection. Its inverse is RightBranchBinaryTree. OrderedTree(BinaryTree) is the left-branch bijection, which is the constructor.
