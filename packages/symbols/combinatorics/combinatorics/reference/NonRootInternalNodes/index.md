---
name: NonRootInternalNodes
domain: Tree statistics
signature: NonRootInternalNodes(tree)
summary: The number of vertices that are neither the root nor a leaf.
catalog:
  - system: findstat
    identity: St000168
    url: https://www.findstat.org/St000168
    on: OrderedTree
statOn:
  - OrderedTree
signatures:
  - call: NonRootInternalNodes(tree)
    description: The number of vertices that are neither the root nor a leaf.
    library: enumeratio-combinatorics
    type: (ordered_tree) -> number
---

- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
