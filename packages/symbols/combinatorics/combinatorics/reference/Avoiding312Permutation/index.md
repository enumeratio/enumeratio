---
name: Avoiding312Permutation
domain: Combinatorial maps
signature: Avoiding312Permutation(DyckPath)
summary: "The 312-avoiding permutation of Bandlow and Killpatrick: from the identity, each area-sequence entry swaps neighbouring positions that many times."
laws:
  - graded:
      from: DyckPaths
      to: Permutations
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00031
    url: https://www.findstat.org/Mp00031
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: Avoiding312Permutation(DyckPath)
    description: "The 312-avoiding permutation of Bandlow and Killpatrick: from the identity, each area-sequence entry swaps neighbouring positions that many times."
    library: enumeratio-combinatorics
    type: (dyck_path) -> permutation
---

- Takes a `DyckPath` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00031. It sends the area to the number of inversions. Injective.
