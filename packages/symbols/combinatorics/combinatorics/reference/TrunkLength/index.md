---
name: TrunkLength
domain: Tree statistics
signature: TrunkLength(tree)
summary: The edges from the root to the first vertex that does not have exactly one child.
catalog:
  - system: findstat
    identity: St000974
    url: https://www.findstat.org/St000974
    on: OrderedTree
statOn:
  - OrderedTree
signatures:
  - call: TrunkLength(tree)
    description: The edges from the root to the first vertex that does not have exactly one child.
    library: enumeratio-combinatorics
    type: (ordered_tree) -> number
---

- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
