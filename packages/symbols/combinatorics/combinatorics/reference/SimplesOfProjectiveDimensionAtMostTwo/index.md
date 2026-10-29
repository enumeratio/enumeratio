---
name: SimplesOfProjectiveDimensionAtMostTwo
domain: Dyck path statistics
signature: SimplesOfProjectiveDimensionAtMostTwo(path)
summary: The simple modules of projective dimension at most two.
catalog:
  - system: findstat
    identity: St001012
    url: https://www.findstat.org/St001012
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SimplesOfProjectiveDimensionAtMostTwo(path)
    description: The simple modules of projective dimension at most two.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
