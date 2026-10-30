---
name: InjectivesOfProjectiveDimensionOneBelowMaximal
domain: Dyck path statistics
signature: InjectivesOfProjectiveDimensionOneBelowMaximal(path)
summary: The indecomposable injective modules whose projective dimension is one less than the global dimension.
catalog:
  - system: findstat
    identity: St001010
    url: https://www.findstat.org/St001010
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: InjectivesOfProjectiveDimensionOneBelowMaximal(path)
    description: The indecomposable injective modules whose projective dimension is one less than the global dimension.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
