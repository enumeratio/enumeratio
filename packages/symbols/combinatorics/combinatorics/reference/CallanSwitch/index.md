---
name: CallanSwitch
domain: Combinatorial maps
signature: CallanSwitch(SetPartition)
summary: "Callan's involution: switches the first closer with the lesser of the least closer and the second element of the block of 1."
laws:
  - bijection
  - involution
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
catalog:
  - system: findstat
    identity: Mp00249
    url: https://www.findstat.org/Mp00249
    on: SetPartition
mapOn:
  - SetPartition
signatures:
  - call: CallanSwitch(SetPartition)
    description: "Callan's involution: switches the first closer with the lesser of the least closer and the second element of the block of 1."
    library: enumeratio-combinatorics
    type: (set_partition) -> set_partition
---

- Takes a `SetPartition` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00249, a joint symmetry of St000971 and St001784.
