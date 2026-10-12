---
name: MinimalRise
domain: Dyck path statistics
signature: MinimalRise(path)
summary: The length of the shortest rise.
catalog:
  - system: findstat
    identity: St000655
    url: https://www.findstat.org/St000655
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: MinimalRise(path)
    description: The length of the shortest rise.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
