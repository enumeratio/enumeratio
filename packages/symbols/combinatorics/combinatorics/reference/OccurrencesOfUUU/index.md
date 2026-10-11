---
name: OccurrencesOfUUU
domain: Dyck path statistics
signature: OccurrencesOfUUU(path)
summary: Occurrences of three consecutive up steps.
catalog:
  - system: findstat
    identity: St000931
    url: https://www.findstat.org/St000931
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: OccurrencesOfUUU(path)
    description: Occurrences of three consecutive up steps.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
