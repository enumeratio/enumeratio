---
name: FoataMajorToInversions
domain: Combinatorial maps
signature: FoataMajorToInversions(Permutation)
summary: "Foata's bijection: each letter is put on the end of the image so far, which is cut into blocks, and every block is rotated one place right."
catalog:
  - system: findstat
    identity: Mp00067
    url: https://www.findstat.org/Mp00067
    on: Permutation
mapOn:
  - Permutation
laws:
  - inverse: FoataInversionsToMajor
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
signatures:
  - call: FoataMajorToInversions(Permutation)
    description: "Foata's bijection: each letter is put on the end of the image so far, which is cut into blocks, and every block is rotated one place right."
    library: enumeratio-combinatorics
    type: (permutation) -> permutation
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00067, Sage's foata_bijection. It sends the major index to the number of inversions; the inverse is FoataInversionsToMajor. Not the cycle-based Foata, which is FindStat's first fundamental transformation.
