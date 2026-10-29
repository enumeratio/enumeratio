---
name: NoncrossingPermutation
domain: Combinatorial maps
signature: NoncrossingPermutation(DyckPath)
summary: "The noncrossing permutation Stump's bijection gives the path: the cycles of its touch points, peeled off round by round."
laws:
  - graded:
      from: DyckPaths
      to: Permutations
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00023
    url: https://www.findstat.org/Mp00023
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: NoncrossingPermutation(DyckPath)
    description: "The noncrossing permutation Stump's bijection gives the path: the cycles of its touch points, peeled off round by round."
    library: enumeratio-combinatorics
    type: (dyck_path) -> permutation
---

- Takes a `DyckPath` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00023, Sage's to_noncrossing_permutation. Injective: its image is the noncrossing permutations. It sends the area to the number of inversions.
