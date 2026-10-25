---
name: Standardization
domain: Combinatorial maps
signature: Standardization(SignedPermutation)
summary: The permutation of the same relative order, taking 1 < … < n < −n < … < −1.
laws:
  - surjection
  - graded:
      from: SignedPermutations
      to: Permutations
    on: signed_permutation
catalog:
  - system: findstat
    identity: Mp00245
    url: https://www.findstat.org/Mp00245
    on: SignedPermutation
mapOn:
  - SignedPermutation
signatures:
  - call: Standardization(SignedPermutation)
    description: The permutation of the same relative order, taking 1 < … < n < −n < … < −1.
    library: enumeratio-combinatorics
    type: (signed_permutation) -> permutation
---

- Takes a `SignedPermutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00245.
