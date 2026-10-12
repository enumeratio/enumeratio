---
name: LastDoubleRisePosition
domain: Dyck path statistics
signature: LastDoubleRisePosition(path)
summary: The position of the last double rise; 0 if there is none.
catalog:
  - system: findstat
    identity: St000874
    url: https://www.findstat.org/St000874
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: LastDoubleRisePosition(path)
    description: The position of the last double rise; 0 if there is none.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
