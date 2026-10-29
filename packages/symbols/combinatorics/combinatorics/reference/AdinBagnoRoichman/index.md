---
name: AdinBagnoRoichman
domain: Combinatorial maps
signature: AdinBagnoRoichman(DyckPath)
summary: "The bijection of Adin, Bagno and Roichman on the 321-avoiding permutation of the path, read back as a path: it keeps the ups before each peak."
laws:
  - bijection
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00124
    url: https://www.findstat.org/Mp00124
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: AdinBagnoRoichman(DyckPath)
    description: "The bijection of Adin, Bagno and Roichman on the 321-avoiding permutation of the path, read back as a path: it keeps the ups before each peak."
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00124. It sends the number of returns to the number of ups after the last double rise.
