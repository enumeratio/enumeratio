---
name: HalfEvenSimpleProjectiveDimensionSum
domain: Dyck path statistics
signature: HalfEvenSimpleProjectiveDimensionSum(path)
summary: Half the sum of the projective dimensions of the simple modules that have even projective dimension.
catalog:
  - system: findstat
    identity: St001507
    url: https://www.findstat.org/St001507
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: HalfEvenSimpleProjectiveDimensionSum(path)
    description: Half the sum of the projective dimensions of the simple modules that have even projective dimension.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
