---
name: KasraouiZeng
domain: Combinatorial maps
signature: KasraouiZeng(SetPartition)
summary: "The Kasraoui-Zeng involution: exchanges the number of crossings with the number of nestings."
laws:
  - bijection
  - involution
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
catalog:
  - system: findstat
    identity: Mp00115
    url: https://www.findstat.org/Mp00115
    on: SetPartition
mapOn:
  - SetPartition
signatures:
  - call: KasraouiZeng(SetPartition)
    description: "The Kasraoui-Zeng involution: exchanges the number of crossings with the number of nestings."
    library: enumeratio-combinatorics
    type: (set_partition) -> set_partition
---

- Takes a `SetPartition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00115, defined in Kasraoui and Zeng's "Distribution of crossings, nestings and alignments of two edges in matchings and partitions".
