---
name: DistinctSubtrees
domain: Tree statistics
signature: DistinctSubtrees(tree)
summary: "BinaryTree: The number of different nonempty subtrees. OrderedTree: The number of different subtrees."
catalog:
  - system: findstat
    identity: St001554
    url: https://www.findstat.org/St001554
    on: BinaryTree
  - system: findstat
    identity: St000521
    url: https://www.findstat.org/St000521
    on: OrderedTree
statOn:
  - BinaryTree
  - OrderedTree
signatures:
  - call: DistinctSubtrees(tree)
    description: "BinaryTree: The number of different nonempty subtrees. OrderedTree: The number of different subtrees."
    library: enumeratio-combinatorics
    type: (binary_tree | ordered_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
