---
name: WeightedSize
domain: Partition statistics
signature: WeightedSize(partition)
summary: The sum of the parts weighted by their row, counting rows from 0.
catalog:
  - system: findstat
    identity: St000185
    url: https://www.findstat.org/St000185
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: WeightedSize(partition)
    description: The sum of the parts weighted by their row, counting rows from 0.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
