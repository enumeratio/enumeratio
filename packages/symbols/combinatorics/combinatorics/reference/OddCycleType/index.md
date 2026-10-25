---
name: OddCycleType
domain: Combinatorial maps
signature: OddCycleType(SignedPermutation)
summary: The lengths of the cycles with an odd number of negative entries, largest first.
catalog:
  - system: findstat
    identity: Mp00169
    url: https://www.findstat.org/Mp00169
    on: SignedPermutation
mapOn:
  - SignedPermutation
signatures:
  - call: OddCycleType(SignedPermutation)
    description: The lengths of the cycles with an odd number of negative entries, largest first.
    library: enumeratio-combinatorics
    type: (signed_permutation) -> integer_partition
---

- Takes a `SignedPermutation` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00169.
