---
name: PeaksMinusNakayamaGlobalDimension
domain: Dyck path statistics
signature: PeaksMinusNakayamaGlobalDimension(path)
summary: The peaks of the path less the global dimension of its linear Nakayama algebra.
catalog:
  - system: findstat
    identity: St000966
    url: https://www.findstat.org/St000966
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: PeaksMinusNakayamaGlobalDimension(path)
    description: The peaks of the path less the global dimension of its linear Nakayama algebra.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
