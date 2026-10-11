---
name: ValleysAboveAxis
domain: Dyck path statistics
signature: ValleysAboveAxis(path)
summary: "Valleys not on the axis: a down step followed by an up step, at height above 0."
catalog:
  - system: findstat
    identity: St000052
    url: https://www.findstat.org/St000052
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: ValleysAboveAxis(path)
    description: "Valleys not on the axis: a down step followed by an up step, at height above 0."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
