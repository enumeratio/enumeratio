---
name: FoataHan
domain: Combinatorial maps
signature: FoataHan(SignedPermutation)
summary: "Foata and Han's fundamental transformation: each letter in turn is put on the end of the image so far, which is cut into blocks and rotated."
catalog:
  - system: findstat
    identity: Mp00190
    url: https://www.findstat.org/Mp00190
    on: SignedPermutation
mapOn:
  - SignedPermutation
laws:
  - bijection
  - inverse: InverseFoataHan
    on: signed_permutation
  - graded:
      from: SignedPermutations
      to: SignedPermutations
    on: signed_permutation
signatures:
  - call: FoataHan(SignedPermutation)
    description: "Foata and Han's fundamental transformation: each letter in turn is put on the end of the image so far, which is cut into blocks and rotated."
    library: enumeratio-combinatorics
    type: (signed_permutation) -> signed_permutation
---

- Takes a `SignedPermutation` and returns a `SignedPermutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00190, a bijection that sends the flag major index to the flag inversion number. Inverse: InverseFoataHan.
