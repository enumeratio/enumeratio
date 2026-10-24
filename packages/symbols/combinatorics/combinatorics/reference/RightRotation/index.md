---
name: RightRotation
domain: Combinatorial maps
signature: RightRotation(BinaryTree)
summary: "Rotate the root to the right: the left child becomes the root, the root its right child."
catalog:
  - system: findstat
    identity: Mp00019
    url: https://www.findstat.org/Mp00019
    on: BinaryTree
mapOn:
  - BinaryTree
laws:
  - bijection
  - inverse: LeftRotation
  - graded:
      from: BinaryTrees
      to: BinaryTrees
    on: binary_tree
signatures:
  - call: RightRotation(BinaryTree)
    description: "Rotate the root to the right: the left child becomes the root, the root its right child."
    library: enumeratio-combinatorics
    type: (binary_tree) -> binary_tree
---

- Takes a `BinaryTree` and returns a `BinaryTree` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00019. A tree whose root has no left child has nothing to rotate; FindStat then moves its right subtree to the left, as [A, .], and so do we. That makes it a bijection on every size, inverse to LeftRotation.
