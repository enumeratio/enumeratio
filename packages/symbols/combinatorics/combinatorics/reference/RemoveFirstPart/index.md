---
name: RemoveFirstPart
domain: Combinatorial maps
signature: RemoveFirstPart(IntegerPartition)
summary: "The partition without its largest part: its first row removed."
catalog:
  - system: findstat
    identity: Mp00202
    url: https://www.findstat.org/Mp00202
    on: IntegerPartition
mapOn:
  - IntegerPartition
signatures:
  - call: RemoveFirstPart(IntegerPartition)
    description: "The partition without its largest part: its first row removed."
    library: enumeratio-combinatorics
    type: (integer_partition) -> integer_partition
---

- Takes a `IntegerPartition` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00202. Lossy: the largest part is forgotten.
