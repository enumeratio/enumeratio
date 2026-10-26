---
name: SubpartitionCount
domain: Partition statistics
signature: SubpartitionCount(partition)
summary: The partitions contained in this one.
catalog:
  - system: findstat
    identity: St000108
    url: https://www.findstat.org/St000108
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SubpartitionCount(partition)
    description: "The partitions contained in this one: the choices of a row size for each row, at most the row's size and the row above's."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
