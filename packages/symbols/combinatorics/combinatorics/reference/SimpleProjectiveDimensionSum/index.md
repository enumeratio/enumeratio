---
name: SimpleProjectiveDimensionSum
domain: Dyck path statistics
signature: SimpleProjectiveDimensionSum(path)
summary: The sum of the projective dimensions of the simple modules of the path's linear Nakayama algebra.
catalog:
  - system: findstat
    identity: St001019
    url: https://www.findstat.org/St001019
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SimpleProjectiveDimensionSum(path)
    description: The sum of the projective dimensions of the simple modules of the path's linear Nakayama algebra.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
