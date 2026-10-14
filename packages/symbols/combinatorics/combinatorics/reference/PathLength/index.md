---
name: PathLength
domain: Tree statistics
signature: PathLength(tree)
summary: "BinaryTree: The sum of the depths of the nodes, the root's being 0: the internal path length. OrderedTree: The sum of the depths of the vertices, the root's being 0."
catalog:
  - system: findstat
    identity: St000398
    url: https://www.findstat.org/St000398
    on: BinaryTree
  - system: findstat
    identity: St000400
    url: https://www.findstat.org/St000400
    on: OrderedTree
statOn:
  - BinaryTree
  - OrderedTree
signatures:
  - call: PathLength(tree)
    description: "BinaryTree: The sum of the depths of the nodes, the root's being 0: the internal path length. OrderedTree: The sum of the depths of the vertices, the root's being 0."
    library: enumeratio-combinatorics
    type: (binary_tree | ordered_tree) -> number
---

- Defined over `BinaryTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `BinaryTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Each vertex below a child sits one deeper than in the child's own tree, so the child contributes its vertex count plus its own path length.
