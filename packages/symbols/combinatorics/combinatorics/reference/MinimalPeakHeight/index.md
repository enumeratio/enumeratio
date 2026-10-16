---
name: MinimalPeakHeight
domain: Dyck path statistics
signature: MinimalPeakHeight(path)
summary: The height of the lowest peak.
catalog:
  - system: findstat
    identity: St001481
    url: https://www.findstat.org/St001481
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: MinimalPeakHeight(path)
    description: The height of the lowest peak.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
