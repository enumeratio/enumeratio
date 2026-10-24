---
name: InteractionDifference
domain: Dyck path statistics
signature: InteractionDifference(path)
summary: "The pyramid weight less the upper interactions: lower interactions less upper interactions."
catalog:
  - system: findstat
    identity: St000335
    url: https://www.findstat.org/St000335
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: InteractionDifference(path)
    description: "The pyramid weight less the upper interactions: lower interactions less upper interactions."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
