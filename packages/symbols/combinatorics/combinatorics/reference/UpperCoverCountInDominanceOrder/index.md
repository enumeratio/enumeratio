---
name: UpperCoverCountInDominanceOrder
domain: Partition statistics
signature: UpperCoverCountInDominanceOrder(partition)
summary: The partitions of the same size that cover this one in dominance order.
catalog:
  - system: findstat
    identity: St000481
    url: https://www.findstat.org/St000481
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: UpperCoverCountInDominanceOrder(partition)
    description: The partitions of the same size that cover this one in dominance order.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
