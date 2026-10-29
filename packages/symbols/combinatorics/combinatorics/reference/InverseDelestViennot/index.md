---
name: InverseDelestViennot
domain: Combinatorial maps
signature: InverseDelestViennot(DyckPath)
summary: The path whose peaks are the polyomino's columns, for the polyomino the classical bijection gives this path.
laws:
  - bijection
  - inverse: DelestViennot
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00227
    url: https://www.findstat.org/Mp00227
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: InverseDelestViennot(DyckPath)
    description: The path whose peaks are the polyomino's columns, for the polyomino the classical bijection gives this path.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00227, "Delest-Viennot-inverse": the inverse of DelestViennot.
