---
name: WachsWhite
domain: Combinatorial maps
signature: WachsWhite(SetPartition)
summary: The set partition whose arcs, read as a rook placement, Wachs and White's bijection gamma carries to a set partition.
laws:
  - bijection
  - inverse: InverseWachsWhite
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
catalog:
  - system: findstat
    identity: Mp00215
    url: https://www.findstat.org/Mp00215
    on: SetPartition
mapOn:
  - SetPartition
signatures:
  - call: WachsWhite(SetPartition)
    description: The set partition whose arcs, read as a rook placement, Wachs and White's bijection gamma carries to a set partition.
    library: enumeratio-combinatorics
    type: (set_partition) -> set_partition
---

- Takes a `SetPartition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00215. The inverse of InverseWachsWhite.
