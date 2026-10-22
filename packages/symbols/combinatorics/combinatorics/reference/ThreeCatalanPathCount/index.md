---
name: ThreeCatalanPathCount
domain: Dyck path statistics
signature: ThreeCatalanPathCount(path)
summary: The paths from the origin to (n, n, n) with x >= y >= z whose first two coordinates trace this Dyck path and whose last two coordinates trace it as well.
catalog:
  - system: findstat
    identity: St001800
    url: https://www.findstat.org/St001800
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: ThreeCatalanPathCount(path)
    description: The paths from the origin to (n, n, n) with x >= y >= z whose first two coordinates trace this Dyck path and whose last two coordinates trace it as well.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- With r the downs between consecutive up steps and s the ups between consecutive down steps, the product over consecutive pairs of binomial(r + s, r).
