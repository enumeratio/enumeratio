---
name: PartsNotCongruentToTwoModuloThree
domain: Partition statistics
signature: PartsNotCongruentToTwoModuloThree(partition)
summary: Parts that are not congruent to 2 modulo 3.
signatures:
  - call: PartsNotCongruentToTwoModuloThree(partition)
    description: Parts that are not congruent to 2 modulo 3.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St001247
    url: https://www.findstat.org/St001247
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
