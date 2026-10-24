---
name: DeBruijnMorselt
domain: Combinatorial maps
signature: DeBruijnMorselt(OrderedTree)
summary: "The right-branch bijection to binary trees followed by the left-branch bijection back: the de Bruijn-Morselt automorphism of the ordered trees."
seeAlso:
  - OrderedTree
  - RightBranchBinaryTree
catalog:
  - system: findstat
    identity: Mp00328
    url: https://www.findstat.org/Mp00328
    on: OrderedTree
mapOn:
  - OrderedTree
laws:
  - bijection
  - graded:
      from: OrderedTrees
      to: OrderedTrees
    on: ordered_tree
signatures:
  - call: DeBruijnMorselt(OrderedTree)
    description: "The right-branch bijection to binary trees followed by the left-branch bijection back: the de Bruijn-Morselt automorphism of the ordered trees."
    library: enumeratio-combinatorics
    type: (ordered_tree) -> ordered_tree
---

- Takes a `OrderedTree` and returns a `OrderedTree` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Defined as a COMPOSITION, applied right to left: [[OrderedTree]] after [[RightBranchBinaryTree]]. Each step goes through its own declared head, so every intermediate value is a properly constructed carrier.
- FindStat's Mp00328. Chaotic in general: Shapiro shows its sixth power is the identity on the trees that correspond to compositions.
