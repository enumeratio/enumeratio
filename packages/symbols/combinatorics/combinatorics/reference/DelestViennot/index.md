---
name: DelestViennot
domain: Combinatorial maps
signature: DelestViennot(DyckPath)
summary: The Dyck path of the parallelogram polyomino whose columns are as tall as the path's peaks, by the classical bijection.
laws:
  - bijection
  - inverse: InverseDelestViennot
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00229
    url: https://www.findstat.org/Mp00229
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: DelestViennot(DyckPath)
    description: The Dyck path of the parallelogram polyomino whose columns are as tall as the path's peaks, by the classical bijection.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00229: the Delest-Viennot bijection from Dyck paths to parallelogram polyominoes, then the classical bijection from polyominoes back to paths. The inverse is InverseDelestViennot.
