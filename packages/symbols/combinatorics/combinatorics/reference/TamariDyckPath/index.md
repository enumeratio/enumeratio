---
name: TamariDyckPath
domain: Combinatorial maps
signature: TamariDyckPath(BinaryTree)
summary: "The Dyck path T(L) U T(R) D of a tree with subtrees L and R: the bijection compatible with the Tamari order."
seeAlso:
  - ReverseComplement
  - DyckPath
  - Mirror
laws:
  - bijection
  - inverse: TamariBinaryTree
  - graded:
      from: BinaryTrees
      to: DyckPaths
    on: binary_tree
catalog:
  - system: findstat
    identity: Mp00020
    url: https://www.findstat.org/Mp00020
    on: BinaryTree
mapOn:
  - BinaryTree
signatures:
  - call: TamariDyckPath(BinaryTree)
    description: "The Dyck path T(L) U T(R) D of a tree with subtrees L and R: the bijection compatible with the Tamari order."
    library: enumeratio-combinatorics
    type: (binary_tree) -> dyck_path
---

- Takes a `BinaryTree` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Defined as a COMPOSITION, applied right to left: [[ReverseComplement]] after [[DyckPath]] after [[Mirror]]. Each step goes through its own declared head, so every intermediate value is a properly constructed carrier.
- FindStat's Mp00020; the inverse is TamariBinaryTree. DyckPath(BinaryTree) reads the other decomposition, U T(L) D T(R), so this is it after a left-right mirror and a reverse-complement.
