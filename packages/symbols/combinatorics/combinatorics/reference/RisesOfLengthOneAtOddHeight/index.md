---
name: RisesOfLengthOneAtOddHeight
domain: Dyck path statistics
signature: RisesOfLengthOneAtOddHeight(path)
summary: Rises of length 1 that start at an odd height.
catalog:
  - system: findstat
    identity: St001172
    url: https://www.findstat.org/St001172
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: RisesOfLengthOneAtOddHeight(path)
    description: Rises of length 1 that start at an odd height.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
