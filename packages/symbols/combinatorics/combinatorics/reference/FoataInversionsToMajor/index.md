---
name: FoataInversionsToMajor
domain: Combinatorial maps
signature: FoataInversionsToMajor(Permutation)
summary: "The inverse of Foata's major-to-inversions bijection: peel off the last letter, rotate the blocks of the rest back."
catalog:
  - system: findstat
    identity: Mp00175
    url: https://www.findstat.org/Mp00175
    on: Permutation
mapOn:
  - Permutation
laws:
  - inverse: FoataMajorToInversions
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
signatures:
  - call: FoataInversionsToMajor(Permutation)
    description: "The inverse of Foata's major-to-inversions bijection: peel off the last letter, rotate the blocks of the rest back."
    library: enumeratio-combinatorics
    type: (permutation) -> permutation
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00175, Sage's foata_bijection_inverse. It sends the number of inversions to the major index.
