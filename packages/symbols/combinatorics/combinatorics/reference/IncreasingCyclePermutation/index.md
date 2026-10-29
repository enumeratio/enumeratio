---
name: IncreasingCyclePermutation
domain: Combinatorial maps
signature: IncreasingCyclePermutation(SetPartition)
summary: "The permutation whose cycles are the blocks, each cycle increasing: every element goes to the next larger in its block, the largest to the least."
laws:
  - graded:
      from: SetPartitions
      to: Permutations
    on: set_partition
catalog:
  - system: findstat
    identity: Mp00080
    url: https://www.findstat.org/Mp00080
    on: SetPartition
mapOn:
  - SetPartition
signatures:
  - call: IncreasingCyclePermutation(SetPartition)
    description: "The permutation whose cycles are the blocks, each cycle increasing: every element goes to the next larger in its block, the largest to the least."
    library: enumeratio-combinatorics
    type: (set_partition) -> permutation
---

- Takes a `SetPartition` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00080, Sage's to_permutation. Injective; it maximizes the exceedances among the permutations with these cycles.
