---
name: SimplesOfProjectiveDimensionTwo
domain: Dyck path statistics
signature: SimplesOfProjectiveDimensionTwo(path)
summary: The simple modules of projective dimension two.
catalog:
  - system: findstat
    identity: St001011
    url: https://www.findstat.org/St001011
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SimplesOfProjectiveDimensionTwo(path)
    description: The simple modules of projective dimension two.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
