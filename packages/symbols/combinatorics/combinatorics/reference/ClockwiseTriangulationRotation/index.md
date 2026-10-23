---
name: ClockwiseTriangulationRotation
domain: Combinatorial maps
signature: ClockwiseTriangulationRotation(DyckPath)
summary: Rotate the triangulation of the (n + 2)-gon the path stands for one step clockwise.
catalog:
  - system: findstat
    identity: Mp00330
    url: https://www.findstat.org/Mp00330
    on: DyckPath
mapOn:
  - DyckPath
laws:
  - bijection
  - inverse: CounterclockwiseTriangulationRotation
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
signatures:
  - call: ClockwiseTriangulationRotation(DyckPath)
    description: Rotate the triangulation of the (n + 2)-gon the path stands for one step clockwise.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00330, the inverse of CounterclockwiseTriangulationRotation. A path is the pre-order walk of the binary tree of the triangulation's faces.
