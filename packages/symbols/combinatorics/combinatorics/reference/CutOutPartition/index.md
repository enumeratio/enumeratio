---
name: CutOutPartition
domain: Combinatorial maps
signature: CutOutPartition(DyckPath)
summary: "The partition cut out of the staircase by the path: part i is the number of downs before the (n + 1 - i)-th up step."
catalog:
  - system: findstat
    identity: Mp00027
    url: https://www.findstat.org/Mp00027
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: CutOutPartition(DyckPath)
    description: "The partition cut out of the staircase by the path: part i is the number of downs before the (n + 1 - i)-th up step."
    library: enumeratio-combinatorics
    type: (dyck_path) -> integer_partition
---

- Takes a `DyckPath` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00027, "to partition". Injective: its image is the partitions inside the staircase (n-1, ..., 1).
