---
name: InverseZetaMap
domain: Combinatorial maps
signature: InverseZetaMap(DyckPath)
summary: The inverse of the zeta map.
catalog:
  - system: findstat
    identity: Mp00032
    url: https://www.findstat.org/Mp00032
    on: DyckPath
mapOn:
  - DyckPath
laws:
  - bijection
  - inverse: ZetaMap
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
signatures:
  - call: InverseZetaMap(DyckPath)
    description: The inverse of the zeta map.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00032. Built from the area sequence one entry at a time, as FindStat does: each entry wraps a stretch of the path so far.
