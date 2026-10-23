---
name: PeaksToValleys
domain: Combinatorial maps
signature: PeaksToValleys(DyckPath)
summary: The path with a valley wherever the original has a peak of height at least 2, each valley two lower than its peak.
catalog:
  - system: findstat
    identity: Mp00222
    url: https://www.findstat.org/Mp00222
    on: DyckPath
mapOn:
  - DyckPath
laws:
  - bijection
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
signatures:
  - call: PeaksToValleys(DyckPath)
    description: The path with a valley wherever the original has a peak of height at least 2, each valley two lower than its peak.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00222, the inverse of rowmotion on Dyck paths as order ideals of the triangular poset.
