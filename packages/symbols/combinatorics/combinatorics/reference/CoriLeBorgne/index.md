---
name: CoriLeBorgne
domain: Combinatorial maps
signature: CoriLeBorgne(DyckPath)
summary: The involution that appends a down step to the path, reverses the word, and takes its one rotation that is a Dyck word followed by a down step.
laws:
  - involution
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00121
    url: https://www.findstat.org/Mp00121
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: CoriLeBorgne(DyckPath)
    description: The involution that appends a down step to the path, reverses the word, and takes its one rotation that is a Dyck word followed by a down step.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00121.
