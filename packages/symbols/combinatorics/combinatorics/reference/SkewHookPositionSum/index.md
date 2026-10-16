---
name: SkewHookPositionSum
domain: Dyck path statistics
signature: SkewHookPositionSum(path)
summary: "The sum of the skew hook positions: after two up steps and a down step, the down step's rank among the down steps; after two down steps and an up step, the rank of the second down step."
catalog:
  - system: findstat
    identity: St000946
    url: https://www.findstat.org/St000946
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SkewHookPositionSum(path)
    description: "The sum of the skew hook positions: after two up steps and a down step, the down step's rank among the down steps; after two down steps and an up step, the rank of the second down step."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
