---
name: AlladiWeight
domain: Partition statistics
signature: AlladiWeight(partition)
summary: The last part times the product over consecutive parts of the gap less 1.
signatures:
  - call: AlladiWeight(partition)
    description: The last part times the product over consecutive parts of the gap less 1.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St000477
    url: https://www.findstat.org/St000477
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
