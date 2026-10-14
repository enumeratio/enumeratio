---
name: TreeFactorial
domain: Tree statistics
signature: TreeFactorial(tree)
summary: "BinaryTree: The product, over the nodes, of the number of nodes at or below each. OrderedTree: The product, over the vertices, of the number of vertices at or below each."
catalog:
  - system: findstat
    identity: St000411
    url: https://www.findstat.org/St000411
    on: BinaryTree
  - system: findstat
    identity: St000410
    url: https://www.findstat.org/St000410
    on: OrderedTree
statOn:
  - BinaryTree
  - OrderedTree
signatures:
  - call: TreeFactorial(tree)
    description: "BinaryTree: The product, over the nodes, of the number of nodes at or below each. OrderedTree: The product, over the vertices, of the number of vertices at or below each."
    library: enumeratio-combinatorics
    type: (binary_tree | ordered_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
