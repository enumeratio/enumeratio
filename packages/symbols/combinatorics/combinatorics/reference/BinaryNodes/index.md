---
name: BinaryNodes
domain: Tree statistics
signature: BinaryNodes(tree)
summary: The number of nodes with two children.
catalog:
  - system: findstat
    identity: St000196
    url: https://www.findstat.org/St000196
    on: BinaryTree
statOn:
  - BinaryTree
signatures:
  - call: BinaryNodes(tree)
    description: The number of nodes with two children.
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
