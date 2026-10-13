---
name: PartsExceedingOnes
domain: Partition statistics
signature: PartsExceedingOnes(partition)
summary: Parts larger than the number of parts equal to 1.
catalog:
  - system: findstat
    identity: St000473
    url: https://www.findstat.org/St000473
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: PartsExceedingOnes(partition)
    description: Parts larger than the number of parts equal to 1.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
