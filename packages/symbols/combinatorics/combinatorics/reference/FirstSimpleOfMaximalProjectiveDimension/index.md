---
name: FirstSimpleOfMaximalProjectiveDimension
domain: Dyck path statistics
signature: FirstSimpleOfMaximalProjectiveDimension(path)
summary: The first vertex, counting from 0, whose simple module has projective dimension equal to the global dimension.
catalog:
  - system: findstat
    identity: St001264
    url: https://www.findstat.org/St001264
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: FirstSimpleOfMaximalProjectiveDimension(path)
    description: The first vertex, counting from 0, whose simple module has projective dimension equal to the global dimension.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
