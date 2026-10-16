---
name: MiddleNonRunHeight
domain: Dyck path statistics
signature: MiddleNonRunHeight(path)
summary: "The height of the middle turning point: the middle one of the peaks and valleys, left to right."
catalog:
  - system: findstat
    identity: St001910
    url: https://www.findstat.org/St001910
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: MiddleNonRunHeight(path)
    description: "The height of the middle turning point: the middle one of the peaks and valleys, left to right."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
