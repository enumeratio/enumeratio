---
name: TwoProtectedNodeCount
domain: Tree statistics
signature: TwoProtectedNodeCount(tree)
summary: The number of vertices whose nearest leaf is exactly two edges away.
signatures:
  - call: TwoProtectedNodeCount(tree)
    description: The number of vertices whose nearest leaf is exactly two edges away.
    library: enumeratio-combinatorics
    type: (ordered_tree) -> number
catalog:
  - system: findstat
    identity: St000523
    url: https://www.findstat.org/St000523
    on: OrderedTree
statOn:
  - OrderedTree
---

- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
