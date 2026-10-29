---
name: SimplesOfProjectiveDimensionAtMostThree
domain: Dyck path statistics
signature: SimplesOfProjectiveDimensionAtMostThree(path)
summary: The simple modules of projective dimension at most three.
catalog:
  - system: findstat
    identity: St001023
    url: https://www.findstat.org/St001023
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SimplesOfProjectiveDimensionAtMostThree(path)
    description: The simple modules of projective dimension at most three.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
