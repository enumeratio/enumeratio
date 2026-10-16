---
name: RisesOfLengthTwo
domain: Dyck path statistics
signature: RisesOfLengthTwo(path)
summary: Rises (maximal runs of up steps) of length 2.
catalog:
  - system: findstat
    identity: St000658
    url: https://www.findstat.org/St000658
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: RisesOfLengthTwo(path)
    description: Rises (maximal runs of up steps) of length 2.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
