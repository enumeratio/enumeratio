---
name: InjectivesOfProjectiveDimensionOne
domain: Dyck path statistics
signature: InjectivesOfProjectiveDimensionOne(path)
summary: The indecomposable injective modules of projective dimension one.
catalog:
  - system: findstat
    identity: St001008
    url: https://www.findstat.org/St001008
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: InjectivesOfProjectiveDimensionOne(path)
    description: The indecomposable injective modules of projective dimension one.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
