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
glyph: dyck
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
catalog:
  - system: findstat
    identity: Mp00012
    url: https://www.findstat.org/Mp00012
    on: BinaryTree
  - system: findstat
    identity: Mp00051
    url: https://www.findstat.org/Mp00051
    on: OrderedTree
---
