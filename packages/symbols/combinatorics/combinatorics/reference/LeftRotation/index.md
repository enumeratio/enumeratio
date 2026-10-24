---
name: LeftRotation
domain: Combinatorial maps
signature: LeftRotation(BinaryTree)
summary: "Rotate the root to the left: the right child becomes the root, the root its left child."
catalog:
  - system: findstat
    identity: Mp00009
    url: https://www.findstat.org/Mp00009
    on: BinaryTree
mapOn:
  - BinaryTree
laws:
  - bijection
  - inverse: RightRotation
  - graded:
      from: BinaryTrees
      to: BinaryTrees
    on: binary_tree
signatures:
  - call: LeftRotation(BinaryTree)
    description: "Rotate the root to the left: the right child becomes the root, the root its left child."
    library: enumeratio-combinatorics
    type: (binary_tree) -> binary_tree
---

- Takes a `BinaryTree` and returns a `BinaryTree` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00009. A tree whose root has no right child has nothing to rotate; FindStat then moves its left subtree to the right, as [., A], and so do we. That makes it a bijection on every size, inverse to RightRotation.
