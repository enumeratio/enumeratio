---
name: RightSubtreeSizeSum
domain: Tree statistics
signature: RightSubtreeSizeSum(tree)
summary: The sum, over the nodes, of the number of nodes in the right subtree.
signatures:
  - call: RightSubtreeSizeSum(tree)
    description: The sum, over the nodes, of the number of nodes in the right subtree.
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
catalog:
  - system: findstat
    identity: St000161
    url: https://www.findstat.org/St000161
    on: BinaryTree
statOn:
  - BinaryTree
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
