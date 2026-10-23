---
name: OrderedTree
domain: Combinatorics
signature: OrderedTree(...)
summary: Catalogued in the enumeratio database; not yet written up here.
catalogCarrier: true
stub: carrier
signatures:
  - call: OrderedTree(...)
    description: Catalogued in the enumeratio database; not yet written up here.
    library: enumeratio-combinatorics
    type: ((integer | list<any>) -> ordered_tree) & ((binary_tree) -> ordered_tree) & ((dyck_path) -> ordered_tree)
laws:
  - inverse: BinaryTree
    on: binary_tree
  - graded:
      from: BinaryTrees
      to: OrderedTrees
    on: binary_tree
  - inverse: DyckPath
    on: dyck_path
  - graded:
      from: DyckPaths
      to: OrderedTrees
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00010
    url: https://www.findstat.org/Mp00010
    on: BinaryTree
  - system: findstat
    identity: Mp00026
    url: https://www.findstat.org/Mp00026
    on: DyckPath
---
