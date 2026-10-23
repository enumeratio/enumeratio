---
name: RightChildCount
domain: Tree statistics
signature: RightChildCount(tree)
summary: The number of nodes with a right child.
signatures:
  - call: RightChildCount(tree)
    description: The number of nodes with a right child.
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
catalog:
  - system: findstat
    identity: St000083
    url: https://www.findstat.org/St000083
    on: BinaryTree
statOn:
  - BinaryTree
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
