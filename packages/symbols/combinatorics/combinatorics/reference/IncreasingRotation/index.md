---
name: IncreasingRotation
domain: Combinatorial maps
signature: IncreasingRotation(SetPartition)
summary: "Every element raised by one, cyclically: the largest becomes 1."
catalog:
  - system: findstat
    identity: Mp00091
    url: https://www.findstat.org/Mp00091
    on: SetPartition
mapOn:
  - SetPartition
laws:
  - bijection
  - inverse: DecreasingRotation
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
signatures:
  - call: IncreasingRotation(SetPartition)
    description: "Every element raised by one, cyclically: the largest becomes 1."
    library: enumeratio-combinatorics
    type: (set_partition) -> set_partition
---

- Takes a `SetPartition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00091 ("rotate increasing"). The inverse is DecreasingRotation, and its n-th power is the identity.
