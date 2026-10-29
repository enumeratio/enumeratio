---
name: TamariBinaryTree
domain: Combinatorial maps
signature: TamariBinaryTree(DyckPath)
summary: "A path D = L U R D as the binary tree whose left and right subtrees are those of L and R: the bijection compatible with the Tamari order."
seeAlso:
  - Mirror
  - BinaryTree
  - ReverseComplement
laws:
  - bijection
  - graded:
      from: DyckPaths
      to: BinaryTrees
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00029
    url: https://www.findstat.org/Mp00029
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: TamariBinaryTree(DyckPath)
    description: "A path D = L U R D as the binary tree whose left and right subtrees are those of L and R: the bijection compatible with the Tamari order."
    library: enumeratio-combinatorics
    type: (dyck_path) -> binary_tree
---

- Takes a `DyckPath` and returns a `BinaryTree` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Defined as a COMPOSITION, applied right to left: [[Mirror]] after [[BinaryTree]] after [[ReverseComplement]]. Each step goes through its own declared head, so every intermediate value is a properly constructed carrier.
- FindStat's Mp00029; TamariDyckPath is its inverse. BinaryTree(DyckPath) reads the other decomposition, U L D R, so this is it after a reverse-complement and a left-right mirror.
