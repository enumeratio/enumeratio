---
name: Avoiding132Permutation
domain: Combinatorial maps
signature: Avoiding132Permutation(DyckPath)
summary: The 132-avoiding permutation of Krattenthaler's bijection, built from the path's area sequence read from the end.
laws:
  - graded:
      from: DyckPaths
      to: Permutations
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00025
    url: https://www.findstat.org/Mp00025
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: Avoiding132Permutation(DyckPath)
    description: The 132-avoiding permutation of Krattenthaler's bijection, built from the path's area sequence read from the end.
    library: enumeratio-combinatorics
    type: (dyck_path) -> permutation
---

- Takes a `DyckPath` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00025, Sage's to_132_avoiding_permutation. Injective.
