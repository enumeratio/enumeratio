---
name: IntertwiningToDualMajorIndex
domain: Combinatorial maps
signature: IntertwiningToDualMajorIndex(SetPartition)
summary: "The set partition whose growth word is the intertwining word: a bijection taking the intertwining number to the dual major index."
laws:
  - bijection
  - inverse: DualMajorIndexToIntertwining
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
catalog:
  - system: findstat
    identity: Mp00171
    url: https://www.findstat.org/Mp00171
    on: SetPartition
mapOn:
  - SetPartition
signatures:
  - call: IntertwiningToDualMajorIndex(SetPartition)
    description: "The set partition whose growth word is the intertwining word: a bijection taking the intertwining number to the dual major index."
    library: enumeratio-combinatorics
    type: (set_partition) -> set_partition
---

- Takes a `SetPartition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00171, the inverse of DualMajorIndexToIntertwining. Entry i of the intertwining word counts the arcs crossing the one that ends at i.
