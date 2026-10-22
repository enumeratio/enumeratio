---
name: NonBoundaryNodes
domain: Tree statistics
signature: NonBoundaryNodes(tree)
summary: The number of nodes on neither the left spine nor the right spine.
signatures:
  - call: NonBoundaryNodes(tree)
    description: The number of nodes on neither the left spine nor the right spine.
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat calls these the internal nodes.
