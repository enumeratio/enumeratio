---
name: Peeling
domain: Combinatorial maps
signature: Peeling(DyckPath)
summary: The path whose area sequence is this one's with its first entry dropped and the rest lowered by two.
catalog:
  - system: findstat
    identity: Mp00103
    url: https://www.findstat.org/Mp00103
    on: DyckPath
mapOn:
  - DyckPath
laws:
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
signatures:
  - call: Peeling(DyckPath)
    description: The path whose area sequence is this one's with its first entry dropped and the rest lowered by two.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00103, the peeling map. Lossy: it is not injective, and a path of semilength n goes to one of the same semilength.
