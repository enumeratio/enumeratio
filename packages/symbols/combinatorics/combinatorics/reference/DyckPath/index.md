---
name: DyckPath
domain: Collections
signature: DyckPath(list)
summary: The singular-inhabitant constructor for a Dyck path, as its up/down steps.
references:
  - system: wikipedia
    identity: Dyck language
  - system: mathworld
    identity: DyckPath
catalogCarrier: true
signatures:
  - call: DyckPath(list)
    description: The singular-inhabitant constructor for a Dyck path, as its up/down steps.
    library: enumeratio-combinatorics
    type: ((list<integer>) -> dyck_path) & ((binary_tree) -> dyck_path) & ((ordered_tree) -> dyck_path)
laws:
  - inverse: BinaryTree
    on: binary_tree
  - graded:
      from: BinaryTrees
      to: DyckPaths
    on: binary_tree
  - inverse: OrderedTree
    on: ordered_tree
  - graded:
      from: OrderedTrees
      to: DyckPaths
    on: ordered_tree
---
