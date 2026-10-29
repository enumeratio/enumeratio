---
name: TwoRowTableau
domain: Combinatorial maps
signature: TwoRowTableau(DyckPath)
summary: The standard tableau of shape (n, n) with the positions of the up steps in its first row and of the down steps in its second.
catalog:
  - system: findstat
    identity: Mp00033
    url: https://www.findstat.org/Mp00033
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: TwoRowTableau(DyckPath)
    description: The standard tableau of shape (n, n) with the positions of the up steps in its first row and of the down steps in its second.
    library: enumeratio-combinatorics
    type: (dyck_path) -> standard_tableau
---

- Takes a `DyckPath` and returns a `StandardTableau` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00033. Injective; the same tableau Promotion and InversePromotion act on.
