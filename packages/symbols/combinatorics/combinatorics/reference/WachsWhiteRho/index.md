---
name: WachsWhiteRho
domain: Combinatorial maps
signature: WachsWhiteRho(SetPartition)
summary: The set partition whose arcs, read as a rook placement, Wachs and White's bijection rho carries to a set partition.
laws:
  - bijection
  - inverse: InverseWachsWhiteRho
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
catalog:
  - system: findstat
    identity: Mp00217
    url: https://www.findstat.org/Mp00217
    on: SetPartition
mapOn:
  - SetPartition
signatures:
  - call: WachsWhiteRho(SetPartition)
    description: The set partition whose arcs, read as a rook placement, Wachs and White's bijection rho carries to a set partition.
    library: enumeratio-combinatorics
    type: (set_partition) -> set_partition
---

- Takes a `SetPartition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00217. The inverse of InverseWachsWhiteRho.
