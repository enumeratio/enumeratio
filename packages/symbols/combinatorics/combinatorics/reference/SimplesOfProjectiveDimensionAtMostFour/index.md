---
name: SimplesOfProjectiveDimensionAtMostFour
domain: Dyck path statistics
signature: SimplesOfProjectiveDimensionAtMostFour(path)
summary: The simple modules of projective dimension at most four.
catalog:
  - system: findstat
    identity: St001190
    url: https://www.findstat.org/St001190
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SimplesOfProjectiveDimensionAtMostFour(path)
    description: The simple modules of projective dimension at most four.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
