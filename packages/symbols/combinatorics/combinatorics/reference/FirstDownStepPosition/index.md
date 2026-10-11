---
name: FirstDownStepPosition
domain: Dyck path statistics
signature: FirstDownStepPosition(path)
summary: The position of the first down step.
catalog:
  - system: findstat
    identity: St000439
    url: https://www.findstat.org/St000439
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: FirstDownStepPosition(path)
    description: The position of the first down step.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
