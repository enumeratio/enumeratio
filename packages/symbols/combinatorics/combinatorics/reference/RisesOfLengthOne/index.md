---
name: RisesOfLengthOne
domain: Dyck path statistics
signature: RisesOfLengthOne(path)
summary: Rises (maximal runs of up steps) of length 1.
catalog:
  - system: findstat
    identity: St000445
    url: https://www.findstat.org/St000445
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: RisesOfLengthOne(path)
    description: Rises (maximal runs of up steps) of length 1.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
