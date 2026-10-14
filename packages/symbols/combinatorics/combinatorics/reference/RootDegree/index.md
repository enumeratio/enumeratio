---
name: RootDegree
domain: Tree statistics
signature: RootDegree(tree)
summary: The number of children of the root.
statOn:
  - OrderedTree
  - PlaneTree
catalog:
  - system: findstat
    identity: St000084
    url: https://www.findstat.org/St000084
    on: OrderedTree
signatures:
  - call: RootDegree(tree)
    description: The number of children of the root.
    library: enumeratio-combinatorics
    type: (ordered_tree) -> number
---

- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
