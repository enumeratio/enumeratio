---
name: BoundaryLength
domain: Tree statistics
signature: BoundaryLength(tree)
summary: The edges on the leftmost path from the root plus those on the rightmost.
catalog:
  - system: findstat
    identity: St000973
    url: https://www.findstat.org/St000973
    on: OrderedTree
statOn:
  - OrderedTree
signatures:
  - call: BoundaryLength(tree)
    description: The edges on the leftmost path from the root plus those on the rightmost.
    library: enumeratio-combinatorics
    type: (ordered_tree) -> number
---

- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
