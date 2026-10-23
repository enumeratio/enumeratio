---
name: PrimeDyckPath
domain: Combinatorial maps
signature: PrimeDyckPath(DyckPath)
summary: "The path wrapped in one more up step first and down step last: a path that touches the diagonal only at its ends."
catalog:
  - system: findstat
    identity: Mp00199
    url: https://www.findstat.org/Mp00199
    on: DyckPath
mapOn:
  - DyckPath
laws:
  - graded:
      from: DyckPaths
      to: DyckPaths
      sizeOffset: 1
    on: dyck_path
signatures:
  - call: PrimeDyckPath(DyckPath)
    description: "The path wrapped in one more up step first and down step last: a path that touches the diagonal only at its ends."
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00199. Injective, one semilength up; the paths it reaches are those with a single return.
