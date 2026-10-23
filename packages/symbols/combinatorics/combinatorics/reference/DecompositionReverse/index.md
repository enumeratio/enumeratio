---
name: DecompositionReverse
domain: Combinatorial maps
signature: DecompositionReverse(DyckPath)
summary: "Split a path as U A D B at its first return, and swap the pieces, recursively: U B' D A'."
catalog:
  - system: findstat
    identity: Mp00101
    url: https://www.findstat.org/Mp00101
    on: DyckPath
mapOn:
  - DyckPath
laws:
  - involution
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
signatures:
  - call: DecompositionReverse(DyckPath)
    description: "Split a path as U A D B at its first return, and swap the pieces, recursively: U B' D A'."
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00101, an involution. It is the binary tree's left-right symmetry carried across the Dyck-path bijection.
