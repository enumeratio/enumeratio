---
name: DoubleStepVisiblePoints
domain: Dyck path statistics
signature: DoubleStepVisiblePoints(path)
summary: Points below the path, at the parity of the path's height there, from which the north-east diagonal meets a double fall and the north-west diagonal meets a double rise.
catalog:
  - system: findstat
    identity: St000683
    url: https://www.findstat.org/St000683
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: DoubleStepVisiblePoints(path)
    description: Points below the path, at the parity of the path's height there, from which the north-east diagonal meets a double fall and the north-west diagonal meets a double rise.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- A point (v, j) has j = h - 2m under the path's vertex v of height h. Its north-east diagonal meets the path at a double fall (v, h') with v - j = v' - h'; its north-west diagonal at a double rise with v + j = v' + h'.
