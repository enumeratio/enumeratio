---
name: RisesOfLengthAtLeastThree
domain: Dyck path statistics
signature: RisesOfLengthAtLeastThree(path)
summary: Rises (maximal runs of up steps) of length at least 3.
catalog:
  - system: findstat
    identity: St000660
    url: https://www.findstat.org/St000660
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: RisesOfLengthAtLeastThree(path)
    description: Rises (maximal runs of up steps) of length at least 3.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
