---
name: ValleyPositionSum
domain: Dyck path statistics
signature: ValleyPositionSum(path)
summary: "The sum of the positions of the valleys: a down step followed by an up step."
catalog:
  - system: findstat
    identity: St000027
    url: https://www.findstat.org/St000027
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: ValleyPositionSum(path)
    description: "The sum of the positions of the valleys: a down step followed by an up step."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat St000027, "the major index of a Dyck path"; the repo's `MajorIndex` on a Dyck path sums the peaks' positions instead.
