---
name: BouncePath
domain: Combinatorial maps
signature: BouncePath(DyckPath)
summary: The bounce path of a Dyck path, bouncing between the path and the diagonal from the far corner.
catalog:
  - system: findstat
    identity: Mp00099
    url: https://www.findstat.org/Mp00099
    on: DyckPath
mapOn:
  - DyckPath
laws:
  - idempotent
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
signatures:
  - call: BouncePath(DyckPath)
    description: The bounce path of a Dyck path, bouncing between the path and the diagonal from the far corner.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00099, the first half of the zeta map. Idempotent: a bounce path is its own bounce path.
