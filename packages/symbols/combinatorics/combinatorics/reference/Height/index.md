---
name: Height
domain: Path and tree statistics
signature: Height(object)
summary: The height of a Dyck path, a binary tree or an ordered tree, each counted as FindStat defines it.
catalog:
  - system: findstat
    identity: St000050
    url: https://www.findstat.org/St000050
    on: BinaryTree
  - system: findstat
    identity: St000166
    url: https://www.findstat.org/St000166
    on: OrderedTree
  - system: findstat
    identity: St000013
    url: https://www.findstat.org/St000013
    on: DyckPath
statOn:
  - BinaryTree
  - ColoredMotzkinPath
  - DelannoyPath
  - DyckPath
  - KDyckPath
  - KMotzkinPath
  - MotzkinPath
  - OrderedTree
  - PlaneTree
  - SchroederPath
signatures:
  - call: Height(path)
    description: The greatest height the Dyck path reaches.
    library: enumeratio-combinatorics
    type: (binary_tree | dyck_path | ordered_tree) -> number
  - call: Height(binaryTree)
    description: The most nodes on a path from the root, so a single node has height 1 and the empty tree 0 (St000050).
    library: enumeratio-combinatorics
    type: (binary_tree | dyck_path | ordered_tree) -> number
  - call: Height(orderedTree)
    description: The most edges on a path from the root, so a single vertex has height 0 (St000166).
    library: enumeratio-combinatorics
    type: (binary_tree | dyck_path | ordered_tree) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- On a `BinaryTree` the height counts nodes: one node has height 1, the empty tree 0.
- On an `OrderedTree` the height counts edges: one vertex has height 0.
