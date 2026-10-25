---
name: NegativesToFlagNegatives
domain: Combinatorial maps
signature: NegativesToFlagNegatives(SignedPermutation)
summary: The signs rearranged so the flag negatives of the image count the negatives of the original.
laws:
  - bijection
  - inverse: FlagNegativesToNegatives
  - graded:
      from: SignedPermutations
      to: SignedPermutations
    on: signed_permutation
catalog:
  - system: findstat
    identity: Mp00270
    url: https://www.findstat.org/Mp00270
    on: SignedPermutation
mapOn:
  - SignedPermutation
signatures:
  - call: NegativesToFlagNegatives(SignedPermutation)
    description: The signs rearranged so the flag negatives of the image count the negatives of the original.
    library: enumeratio-combinatorics
    type: (signed_permutation) -> signed_permutation
---

- Takes a `SignedPermutation` and returns a `SignedPermutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00270: ZerosToFlagZeros on the sign word, the underlying permutation kept.
