---
name: ParallelogramPolyominoDyckPath
domain: Combinatorial maps
signature: ParallelogramPolyominoDyckPath(IntegerPartition)
summary: The Dyck path of the partition read as a parallelogram polyomino, one column per part.
catalog:
  - system: findstat
    identity: Mp00230
    url: https://www.findstat.org/Mp00230
    on: IntegerPartition
mapOn:
  - IntegerPartition
signatures:
  - call: ParallelogramPolyominoDyckPath(IntegerPartition)
    description: The Dyck path of the partition read as a parallelogram polyomino, one column per part.
    library: enumeratio-combinatorics
    type: (integer_partition) -> dyck_path
---

- Takes a `IntegerPartition` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00230. Injective.
