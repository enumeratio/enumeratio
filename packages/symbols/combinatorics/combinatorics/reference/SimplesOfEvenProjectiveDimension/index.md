---
name: SimplesOfEvenProjectiveDimension
domain: Dyck path statistics
signature: SimplesOfEvenProjectiveDimension(path)
summary: The simple modules of even projective dimension.
catalog:
  - system: findstat
    identity: St001165
    url: https://www.findstat.org/St001165
    on: DyckPath
  - system: findstat
    identity: St001471
    url: https://www.findstat.org/St001471
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SimplesOfEvenProjectiveDimension(path)
    description: The simple modules of even projective dimension.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
