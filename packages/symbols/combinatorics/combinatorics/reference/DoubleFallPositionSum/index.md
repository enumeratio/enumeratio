---
name: DoubleFallPositionSum
domain: Dyck path statistics
signature: DoubleFallPositionSum(path)
summary: The sum of the positions where a down step is followed by a down step.
catalog:
  - system: findstat
    identity: St000978
    url: https://www.findstat.org/St000978
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: DoubleFallPositionSum(path)
    description: The sum of the positions where a down step is followed by a down step.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
