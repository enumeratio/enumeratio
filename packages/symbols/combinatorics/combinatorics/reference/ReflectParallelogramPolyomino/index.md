---
name: ReflectParallelogramPolyomino
domain: Combinatorial maps
signature: ReflectParallelogramPolyomino(DyckPath)
summary: Reflect the path's parallelogram polyomino across the diagonal, so the first column becomes the first row.
laws:
  - involution
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00228
    url: https://www.findstat.org/Mp00228
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: ReflectParallelogramPolyomino(DyckPath)
    description: Reflect the path's parallelogram polyomino across the diagonal, so the first column becomes the first row.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00228, an involution: it swaps each adjacent pair of steps from the second step on.
