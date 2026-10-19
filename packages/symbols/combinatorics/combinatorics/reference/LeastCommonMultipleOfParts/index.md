---
name: LeastCommonMultipleOfParts
domain: Partition statistics
signature: LeastCommonMultipleOfParts(partition)
summary: The least common multiple of the parts.
catalog:
  - system: findstat
    identity: St000668
    url: https://www.findstat.org/St000668
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: LeastCommonMultipleOfParts(partition)
    description: The least common multiple of the parts.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
