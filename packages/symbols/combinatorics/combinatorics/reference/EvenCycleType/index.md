---
name: EvenCycleType
domain: Combinatorial maps
signature: EvenCycleType(SignedPermutation)
summary: The lengths of the cycles with an even number of negative entries, largest first.
catalog:
  - system: findstat
    identity: Mp00166
    url: https://www.findstat.org/Mp00166
    on: SignedPermutation
mapOn:
  - SignedPermutation
signatures:
  - call: EvenCycleType(SignedPermutation)
    description: The lengths of the cycles with an even number of negative entries, largest first.
    library: enumeratio-combinatorics
    type: (signed_permutation) -> integer_partition
---

- Takes a `SignedPermutation` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00166. A cycle of the underlying permutation, its entries signed as in the word.
