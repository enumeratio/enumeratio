---
name: LeftBorderSymmetry
domain: Combinatorial maps
signature: LeftBorderSymmetry(BinaryTree)
summary: Reverse the order of the right subtrees hanging off the left border, applying the same symmetry inside each.
catalog:
  - system: findstat
    identity: Mp00018
    url: https://www.findstat.org/Mp00018
    on: BinaryTree
mapOn:
  - BinaryTree
laws:
  - involution
  - graded:
      from: BinaryTrees
      to: BinaryTrees
    on: binary_tree
signatures:
  - call: LeftBorderSymmetry(BinaryTree)
    description: Reverse the order of the right subtrees hanging off the left border, applying the same symmetry inside each.
    library: enumeratio-combinatorics
    type: (binary_tree) -> binary_tree
---

- Takes a `BinaryTree` and returns a `BinaryTree` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00018, an involution.
