---
name: NegateSigns
domain: Combinatorial maps
signature: NegateSigns(SignedPermutation)
summary: "Every sign reversed: multiplication by the longest element −id of the hyperoctahedral group."
laws:
  - bijection
  - involution
  - graded:
      from: SignedPermutations
      to: SignedPermutations
    on: signed_permutation
catalog:
  - system: findstat
    identity: Mp00244
    url: https://www.findstat.org/Mp00244
    on: SignedPermutation
mapOn:
  - SignedPermutation
signatures:
  - call: NegateSigns(SignedPermutation)
    description: Every sign reversed.
    library: enumeratio-combinatorics
    type: (signed_permutation) -> signed_permutation
---

- Takes a `SignedPermutation` and returns a `SignedPermutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00244, "bar".
