---
name: Leaves
domain: Tree statistics
signature: Leaves(tree)
summary: The number of leaves, the vertices with no children.
statOn:
  - BinaryTree
  - LabeledTree
  - OrderedTree
  - PlaneTree
catalog:
  - system: findstat
    identity: St000201
    url: https://www.findstat.org/St000201
    on: BinaryTree
  - system: findstat
    identity: St000167
    url: https://www.findstat.org/St000167
    on: OrderedTree
signatures:
  - call: Leaves(tree)
    description: The number of leaves, the vertices with no children.
    library: enumeratio-combinatorics
    type: (binary_tree | labeled_tree | ordered_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
