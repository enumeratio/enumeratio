---
name: SwapReturnsAndLastDescent
domain: Combinatorial maps
signature: SwapReturnsAndLastDescent(DyckPath)
summary: An involution exchanging the number of returns with the length of the last descent.
laws:
  - bijection
  - involution
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00118
    url: https://www.findstat.org/Mp00118
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: SwapReturnsAndLastDescent(DyckPath)
    description: An involution exchanging the number of returns with the length of the last descent.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00118, the specialization to Dyck paths of the map of Elizalde and Rubey. It keeps the number of ups before each down that is neither a return nor in the last descent.
