---
name: RisesOfLengthThree
domain: Dyck path statistics
signature: RisesOfLengthThree(path)
summary: Rises (maximal runs of up steps) of length 3.
catalog:
  - system: findstat
    identity: St000661
    url: https://www.findstat.org/St000661
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: RisesOfLengthThree(path)
    description: Rises (maximal runs of up steps) of length 3.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
