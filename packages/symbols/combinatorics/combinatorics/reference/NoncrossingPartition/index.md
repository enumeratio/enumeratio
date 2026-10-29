---
name: NoncrossingPartition
domain: Combinatorial maps
signature: NoncrossingPartition(DyckPath)
summary: "Biane's noncrossing set partition: the up steps whose matching downs lie in one run of downs form a block."
laws:
  - graded:
      from: DyckPaths
      to: SetPartitions
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00138
    url: https://www.findstat.org/Mp00138
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: NoncrossingPartition(DyckPath)
    description: "Biane's noncrossing set partition: the up steps whose matching downs lie in one run of downs form a block."
    library: enumeratio-combinatorics
    type: (dyck_path) -> set_partition
---

- Takes a `DyckPath` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00138. Injective: it reaches exactly the noncrossing partitions.
