---
name: BulgarianSolitaire
domain: Combinatorial maps
signature: BulgarianSolitaire(IntegerPartition)
summary: "A move of Bulgarian solitaire: the first column of the Ferrers diagram becomes a new row."
catalog:
  - system: findstat
    identity: Mp00308
    url: https://www.findstat.org/Mp00308
    on: IntegerPartition
mapOn:
  - IntegerPartition
laws:
  - graded:
      from: IntegerPartitions
      to: IntegerPartitions
    on: integer_partition
signatures:
  - call: BulgarianSolitaire(IntegerPartition)
    description: "A move of Bulgarian solitaire: the first column of the Ferrers diagram becomes a new row."
    library: enumeratio-combinatorics
    type: (integer_partition) -> integer_partition
---

- Takes a `IntegerPartition` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00308. Not injective; the fixed points are the staircase partitions.
