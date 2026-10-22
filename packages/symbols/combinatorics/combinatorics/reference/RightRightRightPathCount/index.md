---
name: RightRightRightPathCount
domain: Tree statistics
signature: RightRightRightPathCount(tree)
summary: The number of nodes from which taking the right, then the right, then the right child stays inside the tree.
signatures:
  - call: RightRightRightPathCount(tree)
    description: The number of nodes from which taking the right, then the right, then the right child stays inside the tree.
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- A contiguous pattern of nodes along one path, the subtrees off it anything.
