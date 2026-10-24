---
name: NonRootBinaryNodes
domain: Tree statistics
signature: NonRootBinaryNodes(tree)
summary: The number of nodes other than the root with two children.
signatures:
  - call: NonRootBinaryNodes(tree)
    description: The number of nodes other than the root with two children.
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
catalog:
  - system: findstat
    identity: St000252
    url: https://www.findstat.org/St000252
    on: BinaryTree
statOn:
  - BinaryTree
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The nodes of degree 3 in the tree's drawing: two children and a parent.
