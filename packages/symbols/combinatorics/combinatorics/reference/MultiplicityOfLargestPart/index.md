---
name: MultiplicityOfLargestPart
domain: Partition statistics
signature: MultiplicityOfLargestPart(partition)
summary: How many parts equal the largest.
statOn:
  - IntegerPartition
signatures:
  - call: MultiplicityOfLargestPart(partition)
    description: How many parts equal the largest.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St000993
    url: https://www.findstat.org/St000993
    on: IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
