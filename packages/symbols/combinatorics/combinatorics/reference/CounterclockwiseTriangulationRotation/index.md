---
name: CounterclockwiseTriangulationRotation
domain: Combinatorial maps
signature: CounterclockwiseTriangulationRotation(DyckPath)
summary: Rotate the triangulation of the (n + 2)-gon the path stands for one step counterclockwise.
catalog:
  - system: findstat
    identity: Mp00331
    url: https://www.findstat.org/Mp00331
    on: DyckPath
mapOn:
  - DyckPath
laws:
  - bijection
  - inverse: ClockwiseTriangulationRotation
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
signatures:
  - call: CounterclockwiseTriangulationRotation(DyckPath)
    description: Rotate the triangulation of the (n + 2)-gon the path stands for one step counterclockwise.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00331, the inverse of ClockwiseTriangulationRotation.
