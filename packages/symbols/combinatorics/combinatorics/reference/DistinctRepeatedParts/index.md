---
name: DistinctRepeatedParts
domain: Partition statistics
signature: DistinctRepeatedParts(partition)
summary: Distinct part sizes that occur at least twice.
catalog:
  - system: findstat
    identity: St000257
    url: https://www.findstat.org/St000257
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: DistinctRepeatedParts(partition)
    description: Distinct part sizes that occur at least twice.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
