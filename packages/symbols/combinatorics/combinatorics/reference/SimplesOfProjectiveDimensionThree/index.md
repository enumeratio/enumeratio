---
name: SimplesOfProjectiveDimensionThree
domain: Dyck path statistics
signature: SimplesOfProjectiveDimensionThree(path)
summary: The simple modules of projective dimension three.
catalog:
  - system: findstat
    identity: St001022
    url: https://www.findstat.org/St001022
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SimplesOfProjectiveDimensionThree(path)
    description: The simple modules of projective dimension three.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
