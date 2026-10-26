---
name: SameLengthSubpartitionCount
domain: Partition statistics
signature: SameLengthSubpartitionCount(partition)
summary: The partitions with as many parts contained in this one.
catalog:
  - system: findstat
    identity: St001389
    url: https://www.findstat.org/St001389
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SameLengthSubpartitionCount(partition)
    description: "The partitions with as many parts contained in this one: the same table with every row non-empty."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
