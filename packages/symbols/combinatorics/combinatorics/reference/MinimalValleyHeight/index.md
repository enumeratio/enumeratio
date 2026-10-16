---
name: MinimalValleyHeight
domain: Dyck path statistics
signature: MinimalValleyHeight(path)
summary: The lowest height of a valley, or the semilength if the path has none.
catalog:
  - system: findstat
    identity: St001107
    url: https://www.findstat.org/St001107
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: MinimalValleyHeight(path)
    description: The lowest height of a valley, or the semilength if the path has none.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
