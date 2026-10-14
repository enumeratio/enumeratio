---
name: ExternalPathLength
domain: Tree statistics
signature: ExternalPathLength(tree)
summary: The sum of the lengths of the paths from the root to the empty subtrees.
catalog:
  - system: findstat
    identity: St000399
    url: https://www.findstat.org/St000399
    on: BinaryTree
statOn:
  - BinaryTree
signatures:
  - call: ExternalPathLength(tree)
    description: The sum of the lengths of the paths from the root to the empty subtrees.
    library: enumeratio-combinatorics
    type: (binary_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
