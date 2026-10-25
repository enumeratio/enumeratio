---
name: NegativeCycleType
domain: Combinatorial maps
signature: NegativeCycleType(SignedPermutation)
summary: "The lengths of the negative cycles, largest first: those of the underlying permutation with an odd number of negative entries."
catalog:
  - system: findstat
    identity: Mp00169
    url: https://www.findstat.org/Mp00169
    on: SignedPermutation
mapOn:
  - SignedPermutation
signatures:
  - call: NegativeCycleType(SignedPermutation)
    description: The lengths of the cycles with an odd number of negative entries, largest first.
    library: enumeratio-combinatorics
    type: (signed_permutation) -> integer_partition
---

- Takes a `SignedPermutation` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00169, "odd cycle type". Geck and Pfeiffer's negative cycles.
