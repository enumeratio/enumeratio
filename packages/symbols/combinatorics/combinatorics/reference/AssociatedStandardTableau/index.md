---
name: AssociatedStandardTableau
domain: Combinatorial maps
signature: AssociatedStandardTableau(SetPartition)
summary: The standard tableau whose j-th column holds the j-th smallest elements of the blocks, in increasing order.
catalog:
  - system: findstat
    identity: Mp00258
    url: https://www.findstat.org/Mp00258
    on: SetPartition
mapOn:
  - SetPartition
signatures:
  - call: AssociatedStandardTableau(SetPartition)
    description: The standard tableau whose j-th column holds the j-th smallest elements of the blocks, in increasing order.
    library: enumeratio-combinatorics
    type: (set_partition) -> standard_tableau
---

- Takes a `SetPartition` and returns a `StandardTableau` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00258. Not injective.
