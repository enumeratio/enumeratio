---
name: BounceDeficit
domain: Dyck path statistics
signature: BounceDeficit(path)
summary: The binomial(n, 2) less the area and the bounce.
catalog:
  - system: findstat
    identity: St000376
    url: https://www.findstat.org/St000376
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: BounceDeficit(path)
    description: The binomial(n, 2) less the area and the bounce.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
