---
name: WeakExceedancePartition
domain: Combinatorial maps
signature: WeakExceedancePartition(Permutation)
summary: The coarsest set partition containing every arc from i to π(i) with i ≤ π(i).
laws:
  - graded:
      from: Permutations
      to: SetPartitions
    on: permutation
catalog:
  - system: findstat
    identity: Mp00240
    url: https://www.findstat.org/Mp00240
    on: Permutation
mapOn:
  - Permutation
signatures:
  - call: WeakExceedancePartition(Permutation)
    description: The coarsest set partition containing every arc from i to π(i) with i ≤ π(i).
    library: enumeratio-combinatorics
    type: (permutation) -> set_partition
---

- Takes a `Permutation` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00240, the weak exceedance partition. Not injective.
