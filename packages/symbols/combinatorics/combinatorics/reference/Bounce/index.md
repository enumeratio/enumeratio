---
name: Bounce
domain: Dyck path statistics
signature: Bounce(path)
summary: "The bounce statistic: the sum of the bounce points of the path that bounces from its end back toward the origin."
catalog:
  - system: findstat
    identity: St000005
    url: https://www.findstat.org/St000005
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: Bounce(path)
    description: "The bounce statistic: the sum of the bounce points of the path that bounces from its end back toward the origin."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat St000005. (Bounce, Area) and (Area, Dinv) share the same bivariate distribution (see dyck-statistics.test.ts).
