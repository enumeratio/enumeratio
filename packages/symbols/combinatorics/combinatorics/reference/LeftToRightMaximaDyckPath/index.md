---
name: LeftToRightMaximaDyckPath
domain: Combinatorial maps
signature: LeftToRightMaximaDyckPath(Permutation)
summary: The Dyck path whose rises climb to each left-to-right maximum and whose falls run to the next one.
catalog:
  - system: findstat
    identity: Mp00127
    url: https://www.findstat.org/Mp00127
    on: Permutation
mapOn:
  - Permutation
laws:
  - surjection
  - graded:
      from: Permutations
      to: DyckPaths
    on: permutation
signatures:
  - call: LeftToRightMaximaDyckPath(Permutation)
    description: The Dyck path whose rises climb to each left-to-right maximum and whose falls run to the next one.
    library: enumeratio-combinatorics
    type: (permutation) -> dyck_path
---

- Takes a `Permutation` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00127. Restricted to the 321-avoiding permutations it is a bijection with the Dyck paths.
