---
name: CubedStandardTableauCount
domain: Partition statistics
signature: CubedStandardTableauCount(partition)
summary: The cube of the number of standard tableaux.
catalog:
  - system: findstat
    identity: St000901
    url: https://www.findstat.org/St000901
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: CubedStandardTableauCount(partition)
    description: The cube of the number of standard tableaux.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
