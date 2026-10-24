---
name: PartsNotCongruentToOneModuloThree
domain: Partition statistics
signature: PartsNotCongruentToOneModuloThree(partition)
summary: Parts that are not congruent to 1 modulo 3.
signatures:
  - call: PartsNotCongruentToOneModuloThree(partition)
    description: Parts that are not congruent to 1 modulo 3.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St001251
    url: https://www.findstat.org/St001251
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
