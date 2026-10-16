---
name: LeftToRightMaximalPeaks
domain: Dyck path statistics
signature: LeftToRightMaximalPeaks(path)
summary: Peaks higher than every peak to their left.
catalog:
  - system: findstat
    identity: St001732
    url: https://www.findstat.org/St001732
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: LeftToRightMaximalPeaks(path)
    description: Peaks higher than every peak to their left.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
