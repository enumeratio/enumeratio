---
name: CollessIndex
domain: Tree statistics
signature: CollessIndex(tree)
summary: The sum, over the nodes, of how much the node counts of the two subtrees differ.
catalog:
  - system: findstat
    identity: St001376
    url: https://www.findstat.org/St001376
    on: BinaryTree
statOn:
  - BinaryTree
signatures:
  - call: CollessIndex(tree)
    description: The sum, over the nodes, of how much the node counts of the two subtrees differ.
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
