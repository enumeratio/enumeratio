---
name: MaximumOutDegree
domain: Tree statistics
signature: MaximumOutDegree(tree)
summary: The most children any vertex has.
catalog:
  - system: findstat
    identity: St000328
    url: https://www.findstat.org/St000328
    on: OrderedTree
statOn:
  - OrderedTree
signatures:
  - call: MaximumOutDegree(tree)
    description: The most children any vertex has.
    library: enumeratio-combinatorics
    type: (ordered_tree) -> number
---

- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
