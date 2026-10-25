---
name: FlagNegativesToNegatives
domain: Combinatorial maps
signature: FlagNegativesToNegatives(SignedPermutation)
summary: The signs rearranged so the negatives of the image count the flag negatives of the original.
laws:
  - bijection
  - inverse: NegativesToFlagNegatives
  - graded:
      from: SignedPermutations
      to: SignedPermutations
    on: signed_permutation
catalog:
  - system: findstat
    identity: Mp00271
    url: https://www.findstat.org/Mp00271
    on: SignedPermutation
mapOn:
  - SignedPermutation
signatures:
  - call: FlagNegativesToNegatives(SignedPermutation)
    description: The signs rearranged so the negatives of the image count the flag negatives of the original.
    library: enumeratio-combinatorics
    type: (signed_permutation) -> signed_permutation
---

- Takes a `SignedPermutation` and returns a `SignedPermutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00271, the inverse of NegativesToFlagNegatives.
