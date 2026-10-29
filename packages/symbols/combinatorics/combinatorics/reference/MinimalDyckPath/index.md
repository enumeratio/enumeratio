---
name: MinimalDyckPath
domain: Combinatorial maps
signature: MinimalDyckPath(IntegerPartition)
summary: The shortest Dyck path tracing the shape of the Ferrers diagram.
catalog:
  - system: findstat
    identity: Mp00043
    url: https://www.findstat.org/Mp00043
    on: IntegerPartition
mapOn:
  - IntegerPartition
signatures:
  - call: MinimalDyckPath(IntegerPartition)
    description: The shortest Dyck path tracing the shape of the Ferrers diagram.
    library: enumeratio-combinatorics
    type: (integer_partition) -> dyck_path
---

- Takes a `IntegerPartition` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00043, Sage's partition to minimal Dyck word. Injective: the partition is the region above the path, and this is the shortest path whose region it is.
