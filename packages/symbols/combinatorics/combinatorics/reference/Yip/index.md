---
name: Yip
domain: Combinatorial maps
signature: Yip(SetPartition)
summary: The set partition whose arcs, read as a rook placement, Yip's bijection psi carries to a set partition.
laws:
  - bijection
  - inverse: InverseYip
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
catalog:
  - system: findstat
    identity: Mp00220
    url: https://www.findstat.org/Mp00220
    on: SetPartition
mapOn:
  - SetPartition
signatures:
  - call: Yip(SetPartition)
    description: The set partition whose arcs, read as a rook placement, Yip's bijection psi carries to a set partition.
    library: enumeratio-combinatorics
    type: (set_partition) -> set_partition
---

- Takes a `SetPartition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00220. The inverse of InverseYip.
