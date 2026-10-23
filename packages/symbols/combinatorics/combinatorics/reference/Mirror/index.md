---
name: Mirror
domain: Combinatorial maps
signature: Mirror(BinaryTree)
summary: "The left-right symmetry of a binary tree: every node's two subtrees swapped."
catalog:
  - system: findstat
    identity: Mp00016
    url: https://www.findstat.org/Mp00016
    on: BinaryTree
  - system: findstat
    identity: Mp00048
    url: https://www.findstat.org/Mp00048
    on: OrderedTree
mapOn:
  - BinaryTree
  - OrderedTree
laws:
  - involution
  - graded:
      from: BinaryTrees
      to: BinaryTrees
    on: binary_tree
  - graded:
      from: OrderedTrees
      to: OrderedTrees
    on: ordered_tree
signatures:
  - call: Mirror(BinaryTree)
    description: "The left-right symmetry of a binary tree: every node's two subtrees swapped."
    library: enumeratio-combinatorics
    type: (ordered_tree) -> ordered_tree
---

- Takes a `BinaryTree` and returns a `BinaryTree` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00016, an involution. Conjugated by the Dyck-path bijection it is DecompositionReverse.
- Also takes a `OrderedTree`, returning a `OrderedTree`: The left-right symmetry of an ordered tree: every node's children in the opposite order.
- FindStat's Mp00048, an involution.
