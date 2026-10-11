---
name: RisesOfLengthAtLeastTwo
domain: Dyck path statistics
signature: RisesOfLengthAtLeastTwo(path)
summary: Rises (maximal runs of up steps) of length at least 2.
catalog:
  - system: findstat
    identity: St000659
    url: https://www.findstat.org/St000659
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: RisesOfLengthAtLeastTwo(path)
    description: Rises (maximal runs of up steps) of length at least 2.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
