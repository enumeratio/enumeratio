---
name: InverseWachsWhite
domain: Combinatorial maps
signature: InverseWachsWhite(SetPartition)
summary: The set partition joined by the arcs of the rook placement that Wachs and White's bijection gamma assigns to the set partition.
laws:
  - bijection
  - inverse: WachsWhite
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
catalog:
  - system: findstat
    identity: Mp00216
    url: https://www.findstat.org/Mp00216
    on: SetPartition
mapOn:
  - SetPartition
signatures:
  - call: InverseWachsWhite(SetPartition)
    description: The set partition joined by the arcs of the rook placement that Wachs and White's bijection gamma assigns to the set partition.
    library: enumeratio-combinatorics
    type: (set_partition) -> set_partition
---

- Takes a `SetPartition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00216, the inverse of WachsWhite.
