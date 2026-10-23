---
name: LalanneKreweras
domain: Combinatorial maps
signature: LalanneKreweras(DyckPath)
summary: "The Lalanne-Kreweras involution: labels of the ups and downs that start a double rise or fall, differenced."
catalog:
  - system: findstat
    identity: Mp00120
    url: https://www.findstat.org/Mp00120
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: LalanneKreweras(DyckPath)
    description: "The Lalanne-Kreweras involution: labels of the ups and downs that start a double rise or fall, differenced."
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
laws:
  - involution
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- An involution that swaps the number of peaks with the number of double rises, and area-related statistics with their dual. Mp00120.
