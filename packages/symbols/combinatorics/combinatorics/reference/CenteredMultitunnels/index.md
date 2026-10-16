---
name: CenteredMultitunnels
domain: Dyck path statistics
signature: CenteredMultitunnels(path)
summary: Factorizations of the path into three parts, the middle one a Dyck path and the outer two of equal length.
catalog:
  - system: findstat
    identity: St000675
    url: https://www.findstat.org/St000675
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: CenteredMultitunnels(path)
    description: Factorizations of the path into three parts, the middle one a Dyck path and the outer two of equal length.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
