---
name: PeakHeightSum
domain: Dyck path statistics
signature: PeakHeightSum(path)
summary: The sum of the heights of the peaks.
catalog:
  - system: findstat
    identity: St000395
    url: https://www.findstat.org/St000395
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: PeakHeightSum(path)
    description: The sum of the heights of the peaks.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
