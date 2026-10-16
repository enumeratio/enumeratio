---
name: SumOfOddParts
domain: Partition statistics
signature: SumOfOddParts(partition)
summary: The sum of the odd parts.
catalog:
  - system: findstat
    identity: St001249
    url: https://www.findstat.org/St001249
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SumOfOddParts(partition)
    description: The sum of the odd parts.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
