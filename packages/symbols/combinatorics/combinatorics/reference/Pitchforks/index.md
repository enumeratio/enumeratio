---
name: Pitchforks
domain: Tree statistics
signature: Pitchforks(tree)
summary: The number of nodes whose subtree has exactly two nodes.
catalog:
  - system: findstat
    identity: St000409
    url: https://www.findstat.org/St000409
    on: BinaryTree
statOn:
  - BinaryTree
signatures:
  - call: Pitchforks(tree)
    description: The number of nodes whose subtree has exactly two nodes.
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
