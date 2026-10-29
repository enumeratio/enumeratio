---
name: RowSetPartition
domain: Combinatorial maps
signature: RowSetPartition(StandardTableau)
summary: The set partition whose blocks are the rows of the tableau.
laws:
  - graded:
      from: StandardTableaux
      to: SetPartitions
    on: standard_tableau
catalog:
  - system: findstat
    identity: Mp00284
    url: https://www.findstat.org/Mp00284
    on: StandardTableau
mapOn:
  - StandardTableau
signatures:
  - call: RowSetPartition(StandardTableau)
    description: The set partition whose blocks are the rows of the tableau.
    library: enumeratio-combinatorics
    type: (standard_tableau) -> set_partition
---

- Takes a `StandardTableau` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00284. Injective on the tableaux of a given shape; the shape is the sequence of block sizes.
