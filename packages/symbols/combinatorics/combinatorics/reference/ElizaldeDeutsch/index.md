---
name: ElizaldeDeutsch
domain: Combinatorial maps
signature: ElizaldeDeutsch(DyckPath)
summary: Reading the steps in the order first, last, second, second to last, and so on, a step of the image is an up step when its matching step has not yet been read.
laws:
  - bijection
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
catalog:
  - system: findstat
    identity: Mp00122
    url: https://www.findstat.org/Mp00122
    on: DyckPath
mapOn:
  - DyckPath
signatures:
  - call: ElizaldeDeutsch(DyckPath)
    description: Reading the steps in the order first, last, second, second to last, and so on, a step of the image is an up step when its matching step has not yet been read.
    library: enumeratio-combinatorics
    type: (dyck_path) -> dyck_path
---

- Takes a `DyckPath` and returns a `DyckPath` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00122, the bijection of Elizalde and Deutsch.
