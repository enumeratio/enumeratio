---
name: LeftSpine
domain: Tree statistics
signature: LeftSpine(tree)
summary: "The number of nodes on the left spine of a binary tree: the root and its chain of left children."
statOn:
  - BinaryTree
catalog:
  - system: findstat
    identity: St000061
    url: https://www.findstat.org/St000061
    on: BinaryTree
signatures:
  - call: LeftSpine(tree)
    description: "The number of nodes on the left spine of a binary tree: the root and its chain of left children."
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Counts nodes, root included.
