---
name: InverseYip
domain: Combinatorial maps
signature: InverseYip(SetPartition)
summary: The set partition joined by the arcs of the rook placement that Yip's bijection psi assigns to the set partition.
laws:
  - bijection
  - inverse: Yip
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
catalog:
  - system: findstat
    identity: Mp00219
    url: https://www.findstat.org/Mp00219
    on: SetPartition
mapOn:
  - SetPartition
signatures:
  - call: InverseYip(SetPartition)
    description: The set partition joined by the arcs of the rook placement that Yip's bijection psi assigns to the set partition.
    library: enumeratio-combinatorics
    type: (set_partition) -> set_partition
---

- Takes a `SetPartition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00219, the inverse of Yip.
