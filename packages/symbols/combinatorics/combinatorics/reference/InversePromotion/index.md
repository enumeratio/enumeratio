---
name: InversePromotion
domain: Combinatorial maps
signature: InversePromotion(DyckPath)
summary: Inverse promotion of the Dyck path's two-row standard tableau, read back as a path.
catalog:
  - system: findstat
    identity: Mp00143
    url: https://www.findstat.org/Mp00143
    on: DyckPath
mapOn:
  - DyckPath
laws:
  - inverse: Promotion
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
signatures:
  - call: InversePromotion(DyckPath)
    description: Inverse promotion of the Dyck path's two-row standard tableau, read back as a path.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00143; the inverse is Promotion.
