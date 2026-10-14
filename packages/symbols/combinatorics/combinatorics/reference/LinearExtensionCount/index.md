---
name: LinearExtensionCount
domain: Tree statistics
signature: LinearExtensionCount(tree)
summary: "BinaryTree: The number of linear extensions of the tree as a poset: n! over the tree factorial. OrderedTree: The number of linear extensions of the tree as a poset: n! over the tree factorial."
catalog:
  - system: findstat
    identity: St000045
    url: https://www.findstat.org/St000045
    on: BinaryTree
  - system: findstat
    identity: St000085
    url: https://www.findstat.org/St000085
    on: OrderedTree
statOn:
  - BinaryTree
  - OrderedTree
signatures:
  - call: LinearExtensionCount(tree)
    description: "BinaryTree: The number of linear extensions of the tree as a poset: n! over the tree factorial. OrderedTree: The number of linear extensions of the tree as a poset: n! over the tree factorial."
    library: enumeratio-combinatorics
    type: (binary_tree | ordered_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
