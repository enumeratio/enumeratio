---
name: VertexHeightSum
domain: Tree statistics
signature: VertexHeightSum(tree)
summary: The sum, over the nodes, of the node's height (the most nodes on a path down).
signatures:
  - call: VertexHeightSum(tree)
    description: The sum, over the nodes, of the node's height (the most nodes on a path down).
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
