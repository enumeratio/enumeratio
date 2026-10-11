---
name: FirstMaximalPeakPosition
domain: Dyck path statistics
signature: FirstMaximalPeakPosition(path)
summary: The position of the up step into the first peak of maximal height.
catalog:
  - system: findstat
    identity: St001809
    url: https://www.findstat.org/St001809
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: FirstMaximalPeakPosition(path)
    description: The position of the up step into the first peak of maximal height.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
