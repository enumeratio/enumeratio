---
name: InverseFoataHan
domain: Combinatorial maps
signature: InverseFoataHan(SignedPermutation)
summary: "The inverse of Foata and Han's transformation: the last letter is peeled off and the blocks of the rest are rotated back."
catalog:
  - system: findstat
    identity: Mp00194
    url: https://www.findstat.org/Mp00194
    on: SignedPermutation
mapOn:
  - SignedPermutation
signatures:
  - call: InverseFoataHan(SignedPermutation)
    description: "The inverse of Foata and Han's transformation: the last letter is peeled off and the blocks of the rest are rotated back."
    library: enumeratio-combinatorics
    type: (signed_permutation) -> signed_permutation
---

- Takes a `SignedPermutation` and returns a `SignedPermutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00194, sending the flag inversion number to the flag major index.
