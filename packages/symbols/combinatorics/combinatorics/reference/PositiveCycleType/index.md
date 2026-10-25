---
name: PositiveCycleType
domain: Combinatorial maps
signature: PositiveCycleType(SignedPermutation)
summary: "The lengths of the positive cycles, largest first: those of the underlying permutation with an even number of negative entries."
catalog:
  - system: findstat
    identity: Mp00166
    url: https://www.findstat.org/Mp00166
    on: SignedPermutation
mapOn:
  - SignedPermutation
signatures:
  - call: PositiveCycleType(SignedPermutation)
    description: The lengths of the cycles with an even number of negative entries, largest first.
    library: enumeratio-combinatorics
    type: (signed_permutation) -> integer_partition
---

- Takes a `SignedPermutation` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00166, "even cycle type". Geck and Pfeiffer's positive cycles.
