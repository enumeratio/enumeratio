---
name: SumOfPartsAtLeastTwo
domain: Partition statistics
signature: SumOfPartsAtLeastTwo(partition)
summary: The sum of the parts that are at least 2.
catalog:
  - system: findstat
    identity: St001279
    url: https://www.findstat.org/St001279
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SumOfPartsAtLeastTwo(partition)
    description: The sum of the parts that are at least 2.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
