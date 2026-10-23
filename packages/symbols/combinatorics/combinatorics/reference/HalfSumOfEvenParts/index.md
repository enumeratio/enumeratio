---
name: HalfSumOfEvenParts
domain: Partition statistics
signature: HalfSumOfEvenParts(partition)
summary: Half the sum of the even parts.
signatures:
  - call: HalfSumOfEvenParts(partition)
    description: Half the sum of the even parts.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St001252
    url: https://www.findstat.org/St001252
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
