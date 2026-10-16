---
name: HillsOfSizeThree
domain: Dyck path statistics
signature: HillsOfSizeThree(path)
summary: Occurrences of three up steps then three down steps, starting on the axis.
catalog:
  - system: findstat
    identity: St001141
    url: https://www.findstat.org/St001141
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: HillsOfSizeThree(path)
    description: Occurrences of three up steps then three down steps, starting on the axis.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
