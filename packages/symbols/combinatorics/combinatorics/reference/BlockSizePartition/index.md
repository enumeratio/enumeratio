---
name: BlockSizePartition
domain: Combinatorial maps
signature: BlockSizePartition(SetPartition)
summary: The partition of n a set partition's block sizes form, largest first.
catalog:
  - system: findstat
    identity: Mp00079
    url: https://www.findstat.org/Mp00079
    on: SetPartition
mapOn:
  - SetPartition
laws:
  - surjection
  - graded:
      from: SetPartitions
      to: IntegerPartitions
    on: set_partition
signatures:
  - call: BlockSizePartition(SetPartition)
    description: The partition of n a set partition's block sizes form, largest first.
    library: enumeratio-combinatorics
    type: (set_partition) -> integer_partition
---

- Takes a `SetPartition` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Lossy: which elements share a block is forgotten, so it is not a constructor overload.
