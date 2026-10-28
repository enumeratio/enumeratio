---
name: StandardTableauCountWithMajorIndexCongruentToOneModuloSize
domain: Partition statistics
signature: StandardTableauCountWithMajorIndexCongruentToOneModuloSize(partition)
summary: The standard Young tableaux whose major index leaves remainder 1 on division by the size of the shape (never, when the size is 1).
catalog:
  - system: findstat
    identity: St001440
    url: https://www.findstat.org/St001440
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: StandardTableauCountWithMajorIndexCongruentToOneModuloSize(partition)
    description: The standard Young tableaux whose major index leaves remainder 1 on division by the size of the shape (never, when the size is 1).
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
