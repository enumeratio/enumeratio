---
name: NakayamaGlobalDimension
domain: Dyck path statistics
signature: NakayamaGlobalDimension(path)
summary: "The global dimension of the linear Nakayama algebra of the path: the largest projective dimension of a simple module."
catalog:
  - system: findstat
    identity: St000684
    url: https://www.findstat.org/St000684
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: NakayamaGlobalDimension(path)
    description: "The global dimension of the linear Nakayama algebra of the path: the largest projective dimension of a simple module."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St000684.
