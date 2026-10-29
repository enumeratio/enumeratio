---
name: DualMajorIndexToIntertwining
domain: Combinatorial maps
signature: DualMajorIndexToIntertwining(SetPartition)
summary: "The inverse of IntertwiningToDualMajorIndex: read the growth word as an intertwining word and rebuild the blocks."
laws:
  - bijection
  - inverse: IntertwiningToDualMajorIndex
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
catalog:
  - system: findstat
    identity: Mp00174
    url: https://www.findstat.org/Mp00174
    on: SetPartition
mapOn:
  - SetPartition
signatures:
  - call: DualMajorIndexToIntertwining(SetPartition)
    description: "The inverse of IntertwiningToDualMajorIndex: read the growth word as an intertwining word and rebuild the blocks."
    library: enumeratio-combinatorics
    type: (set_partition) -> set_partition
---

- Takes a `SetPartition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00174.
