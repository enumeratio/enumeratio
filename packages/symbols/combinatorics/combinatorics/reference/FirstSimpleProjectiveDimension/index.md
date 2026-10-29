---
name: FirstSimpleProjectiveDimension
domain: Dyck path statistics
signature: FirstSimpleProjectiveDimension(path)
summary: The projective dimension of the first simple module of the path's linear Nakayama algebra.
catalog:
  - system: findstat
    identity: St001135
    url: https://www.findstat.org/St001135
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: FirstSimpleProjectiveDimension(path)
    description: The projective dimension of the first simple module of the path's linear Nakayama algebra.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St001135.
