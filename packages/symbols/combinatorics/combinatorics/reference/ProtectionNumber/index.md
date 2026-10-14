---
name: ProtectionNumber
domain: Tree statistics
signature: ProtectionNumber(tree)
summary: "BinaryTree: The number of nodes on a shortest path from the root to an empty subtree. OrderedTree: The distance from the root to the nearest leaf."
catalog:
  - system: findstat
    identity: St000701
    url: https://www.findstat.org/St000701
    on: BinaryTree
  - system: findstat
    identity: St000700
    url: https://www.findstat.org/St000700
    on: OrderedTree
statOn:
  - BinaryTree
  - OrderedTree
signatures:
  - call: ProtectionNumber(tree)
    description: "BinaryTree: The number of nodes on a shortest path from the root to an empty subtree. OrderedTree: The distance from the root to the nearest leaf."
    library: enumeratio-combinatorics
    type: (binary_tree | ordered_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
