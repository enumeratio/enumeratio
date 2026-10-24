---
name: DecreasingRotation
domain: Combinatorial maps
signature: DecreasingRotation(SetPartition)
summary: "Every element lowered by one, cyclically: 1 becomes the largest."
catalog:
  - system: findstat
    identity: Mp00176
    url: https://www.findstat.org/Mp00176
    on: SetPartition
mapOn:
  - SetPartition
laws:
  - bijection
  - inverse: IncreasingRotation
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
signatures:
  - call: DecreasingRotation(SetPartition)
    description: "Every element lowered by one, cyclically: 1 becomes the largest."
    library: enumeratio-combinatorics
    type: (set_partition) -> set_partition
---

- Takes a `SetPartition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00176 ("rotate decreasing"). The inverse is IncreasingRotation.
