---
name: PruningNumber
domain: Tree statistics
signature: PruningNumber(tree)
summary: The number of prunings, each deleting every maximal hanging branch (a path of single-child vertices to a leaf), that reduce the tree to a single vertex.
signatures:
  - call: PruningNumber(tree)
    description: The number of prunings, each deleting every maximal hanging branch (a path of single-child vertices to a leaf), that reduce the tree to a single vertex.
    library: enumeratio-combinatorics
    type: (ordered_tree) -> number
catalog:
  - system: findstat
    identity: St000679
    url: https://www.findstat.org/St000679
    on: OrderedTree
statOn:
  - OrderedTree
---

- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
