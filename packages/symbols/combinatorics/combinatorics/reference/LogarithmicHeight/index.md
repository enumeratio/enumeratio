---
name: LogarithmicHeight
domain: Dyck path statistics
signature: LogarithmicHeight(path)
summary: The floor of the binary logarithm of the height plus one.
catalog:
  - system: findstat
    identity: St000920
    url: https://www.findstat.org/St000920
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: LogarithmicHeight(path)
    description: The floor of the binary logarithm of the height plus one.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
