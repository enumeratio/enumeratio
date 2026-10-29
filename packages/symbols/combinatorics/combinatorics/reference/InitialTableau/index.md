---
name: InitialTableau
domain: Combinatorial maps
signature: InitialTableau(IntegerPartition)
summary: The standard tableau of the shape filled row by row with 1, 2, ..., n.
laws:
  - graded:
      from: IntegerPartitions
      to: StandardTableaux
    on: integer_partition
catalog:
  - system: findstat
    identity: Mp00042
    url: https://www.findstat.org/Mp00042
    on: IntegerPartition
mapOn:
  - IntegerPartition
signatures:
  - call: InitialTableau(IntegerPartition)
    description: The standard tableau of the shape filled row by row with 1, 2, ..., n.
    library: enumeratio-combinatorics
    type: (integer_partition) -> standard_tableau
---

- Takes a `IntegerPartition` and returns a `StandardTableau` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00042. Injective.
