---
name: GlobalMaxima
domain: Dyck path statistics
signature: GlobalMaxima(path)
summary: The number of points of the path at the greatest height it reaches.
catalog:
  - system: findstat
    identity: St000617
    url: https://www.findstat.org/St000617
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: GlobalMaxima(path)
    description: The number of points of the path at the greatest height it reaches.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The origin counts as a point, so the empty path has one; otherwise these are its highest peaks.
