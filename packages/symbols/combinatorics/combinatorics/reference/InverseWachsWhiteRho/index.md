---
name: InverseWachsWhiteRho
domain: Combinatorial maps
signature: InverseWachsWhiteRho(SetPartition)
summary: The set partition joined by the arcs of the rook placement that Wachs and White's bijection rho assigns to the set partition.
laws:
  - bijection
  - inverse: WachsWhiteRho
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
catalog:
  - system: findstat
    identity: Mp00218
    url: https://www.findstat.org/Mp00218
    on: SetPartition
mapOn:
  - SetPartition
signatures:
  - call: InverseWachsWhiteRho(SetPartition)
    description: The set partition joined by the arcs of the rook placement that Wachs and White's bijection rho assigns to the set partition.
    library: enumeratio-combinatorics
    type: (set_partition) -> set_partition
---

- Takes a `SetPartition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00218, the inverse of WachsWhiteRho.
