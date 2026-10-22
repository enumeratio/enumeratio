---
name: BoundaryNodes
domain: Tree statistics
signature: BoundaryNodes(tree)
summary: The number of nodes on the left spine or the right spine, the root counted once.
signatures:
  - call: BoundaryNodes(tree)
    description: The number of nodes on the left spine or the right spine, the root counted once.
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat calls these the external nodes; the name stays off the empty subtrees, which are Knuth's.
