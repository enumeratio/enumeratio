---
name: BarnabeiCastronuovo
domain: Combinatorial maps
signature: BarnabeiCastronuovo(DyckPath)
summary: The Schützenberger involution that reverses the canonical decompositions of the two halves of the path.
laws:
  - involution
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00123
    url: https://www.findstat.org/Mp00123
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: BarnabeiCastronuovo(DyckPath)
    description: The Schützenberger involution that reverses the canonical decompositions of the two halves of the path.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00123. In each half the up steps the path never returns beneath are the empty pieces of the decomposition.
