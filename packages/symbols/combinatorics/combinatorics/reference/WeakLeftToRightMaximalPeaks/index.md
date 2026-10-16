---
name: WeakLeftToRightMaximalPeaks
domain: Dyck path statistics
signature: WeakLeftToRightMaximalPeaks(path)
summary: Peaks at least as high as every peak to their left.
catalog:
  - system: findstat
    identity: St001733
    url: https://www.findstat.org/St001733
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: WeakLeftToRightMaximalPeaks(path)
    description: Peaks at least as high as every peak to their left.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
