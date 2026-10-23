---
name: UnderlyingSetPartition
domain: Combinatorial maps
signature: UnderlyingSetPartition(SetComposition)
summary: The set partition with the same blocks, the order of the blocks forgotten.
catalog:
  - system: findstat
    identity: Mp00285
    url: https://www.findstat.org/Mp00285
    on: SetComposition
mapOn:
  - SetComposition
laws:
  - surjection
  - graded:
      from: SetCompositions
      to: SetPartitions
    on: set_composition
signatures:
  - call: UnderlyingSetPartition(SetComposition)
    description: The set partition with the same blocks, the order of the blocks forgotten.
    library: enumeratio-combinatorics
    type: (set_composition) -> set_partition
---

- Takes a `SetComposition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00285. Lossy: each set partition has as many orderings as it has blocks, factorially.
