---
name: BoxesBelowAtLeastTwoPeaks
domain: Dyck path statistics
signature: BoxesBelowAtLeastTwoPeaks(path)
summary: The boxes between the path and the diagonal that lie right of and below at least two peaks.
catalog:
  - system: findstat
    identity: St000980
    url: https://www.findstat.org/St000980
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: BoxesBelowAtLeastTwoPeaks(path)
    description: The boxes between the path and the diagonal that lie right of and below at least two peaks.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
