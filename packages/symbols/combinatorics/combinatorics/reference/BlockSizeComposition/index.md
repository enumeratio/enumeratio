---
name: BlockSizeComposition
domain: Combinatorial maps
signature: BlockSizeComposition(SetPartition)
summary: The block sizes of a set partition, its blocks taken in order of their least elements.
catalog:
  - system: findstat
    identity: Mp00128
    url: https://www.findstat.org/Mp00128
    on: SetPartition
mapOn:
  - SetPartition
laws:
  - surjection
  - graded:
      from: SetPartitions
      to: IntegerCompositions
    on: set_partition
signatures:
  - call: BlockSizeComposition(SetPartition)
    description: The block sizes of a set partition, its blocks taken in order of their least elements.
    library: enumeratio-combinatorics
    type: (set_partition) -> composition
---

- Takes a `SetPartition` and returns a `Composition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00128. Lossy: which elements share a block is forgotten, so it is not a constructor overload.
