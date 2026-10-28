---
name: MaximalRookPlacementCount
domain: Partition statistics
signature: MaximalRookPlacementCount(partition)
summary: The ways to place as many non-attacking rooks as possible on the Ferrers board of the diagram.
catalog:
  - system: findstat
    identity: St001659
    url: https://www.findstat.org/St001659
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: MaximalRookPlacementCount(partition)
    description: The ways to place as many non-attacking rooks as possible on the Ferrers board of the diagram.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
