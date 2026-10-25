---
name: UnderlyingPermutation
domain: Combinatorial maps
signature: UnderlyingPermutation(SignedPermutation)
summary: The permutation left when the signs are forgotten.
laws:
  - surjection
  - graded:
      from: SignedPermutations
      to: Permutations
    on: signed_permutation
catalog:
  - system: findstat
    identity: Mp00163
    url: https://www.findstat.org/Mp00163
    on: SignedPermutation
mapOn:
  - SignedPermutation
signatures:
  - call: UnderlyingPermutation(SignedPermutation)
    description: The permutation left when the signs are forgotten.
    library: enumeratio-combinatorics
    type: (signed_permutation) -> permutation
---

- Takes a `SignedPermutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00163. Lossy: the signs are forgotten, so it is not a constructor overload.
