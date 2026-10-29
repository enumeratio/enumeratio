---
name: SimpleProjectiveDimensionProduct
domain: Dyck path statistics
signature: SimpleProjectiveDimensionProduct(path)
summary: The product of the nonzero projective dimensions of the simple modules of the path's linear Nakayama algebra.
catalog:
  - system: findstat
    identity: St001299
    url: https://www.findstat.org/St001299
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SimpleProjectiveDimensionProduct(path)
    description: The product of the nonzero projective dimensions of the simple modules of the path's linear Nakayama algebra.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
