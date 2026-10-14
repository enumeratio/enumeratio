---
name: Breadth
domain: Tree statistics
signature: Breadth(tree)
summary: The most vertices at any one depth.
catalog:
  - system: findstat
    identity: St001058
    url: https://www.findstat.org/St001058
    on: OrderedTree
statOn:
  - OrderedTree
signatures:
  - call: Breadth(tree)
    description: The most vertices at any one depth.
    library: enumeratio-combinatorics
    type: (ordered_tree) -> number
---

- Defined over `OrderedTree` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `OrderedTree` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Each level is the list of its vertices; the next is their children, joined.
