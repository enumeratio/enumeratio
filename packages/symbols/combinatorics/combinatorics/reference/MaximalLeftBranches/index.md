---
name: MaximalLeftBranches
domain: Tree statistics
signature: MaximalLeftBranches(tree)
summary: The number of maximal paths of left edges.
catalog:
  - system: findstat
    identity: St000919
    url: https://www.findstat.org/St000919
    on: BinaryTree
statOn:
  - BinaryTree
signatures:
  - call: MaximalLeftBranches(tree)
    description: The number of maximal paths of left edges.
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- A branch starts at a node with a left child that is not itself a left child.
