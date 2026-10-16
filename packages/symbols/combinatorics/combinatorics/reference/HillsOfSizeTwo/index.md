---
name: HillsOfSizeTwo
domain: Dyck path statistics
signature: HillsOfSizeTwo(path)
summary: Occurrences of two up steps then two down steps, starting on the axis.
catalog:
  - system: findstat
    identity: St001139
    url: https://www.findstat.org/St001139
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: HillsOfSizeTwo(path)
    description: Occurrences of two up steps then two down steps, starting on the axis.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
