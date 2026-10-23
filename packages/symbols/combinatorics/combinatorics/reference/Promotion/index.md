---
name: Promotion
domain: Combinatorial maps
signature: Promotion(DyckPath)
summary: Promotion of the Dyck path's two-row standard tableau, read back as a path.
catalog:
  - system: findstat
    identity: Mp00142
    url: https://www.findstat.org/Mp00142
    on: DyckPath
mapOn:
  - DyckPath
laws:
  - inverse: InversePromotion
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
signatures:
  - call: Promotion(DyckPath)
    description: Promotion of the Dyck path's two-row standard tableau, read back as a path.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00142; the inverse is InversePromotion.
