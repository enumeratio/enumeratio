---
name: ProperlyBelowDyckPathCount
domain: Dyck path statistics
signature: ProperlyBelowDyckPathCount(path)
summary: The Dyck paths of the same semilength weakly below this path, itself excluded.
catalog:
  - system: findstat
    identity: St000421
    url: https://www.findstat.org/St000421
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: ProperlyBelowDyckPathCount(path)
    description: The Dyck paths of the same semilength weakly below this path, itself excluded.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
