---
name: ZetaMap
domain: Combinatorial maps
signature: ZetaMap(DyckPath)
summary: "The zeta map: the area sequence read backwards, level by level from the top, as ups and downs."
catalog:
  - system: findstat
    identity: Mp00030
    url: https://www.findstat.org/Mp00030
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: ZetaMap(DyckPath)
    description: "The zeta map: the area sequence read backwards, level by level from the top, as ups and downs."
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
laws:
  - bijection
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Sends the bistatistic (area, dinv) to (bounce, area). FindStat's Mp00030; its inverse is Mp00032.
