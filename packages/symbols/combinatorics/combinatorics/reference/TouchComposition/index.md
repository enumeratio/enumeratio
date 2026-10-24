---
name: TouchComposition
domain: Combinatorial maps
signature: TouchComposition(DyckPath)
summary: The semilengths of the primitive pieces between a path's returns to the diagonal.
catalog:
  - system: findstat
    identity: Mp00100
    url: https://www.findstat.org/Mp00100
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: TouchComposition(DyckPath)
    description: The semilengths of the primitive pieces between a path's returns to the diagonal.
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
