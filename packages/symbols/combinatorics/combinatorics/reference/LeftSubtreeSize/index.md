---
name: LeftSubtreeSize
domain: Tree statistics
signature: LeftSubtreeSize(tree)
summary: The number of nodes in the left subtree of the root.
catalog:
  - system: findstat
    identity: St000051
    url: https://www.findstat.org/St000051
    on: BinaryTree
statOn:
  - BinaryTree
signatures:
  - call: LeftSubtreeSize(tree)
    description: The number of nodes in the left subtree of the root.
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
