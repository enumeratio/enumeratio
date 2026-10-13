---
name: MultiplicityOfSmallestPart
domain: Partition statistics
signature: MultiplicityOfSmallestPart(partition)
summary: How many parts equal the smallest.
catalog:
  - system: findstat
    identity: St000160
    url: https://www.findstat.org/St000160
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: MultiplicityOfSmallestPart(partition)
    description: How many parts equal the smallest.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
