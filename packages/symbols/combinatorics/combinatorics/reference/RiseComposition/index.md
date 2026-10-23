---
name: RiseComposition
domain: Combinatorial maps
signature: RiseComposition(DyckPath)
summary: The lengths of the maximal runs of up steps, left to right.
catalog:
  - system: findstat
    identity: Mp00102
    url: https://www.findstat.org/Mp00102
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: RiseComposition(DyckPath)
    description: The lengths of the maximal runs of up steps, left to right.
    library: enumeratio-combinatorics
    type: (dyck_path) -> composition
laws:
  - surjection
  - graded:
      from: DyckPaths
      to: IntegerCompositions
    on: dyck_path
---

- Takes a `DyckPath` and returns a `Composition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
