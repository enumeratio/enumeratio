---
name: MajorIndexNorthCount
domain: Dyck path statistics
signature: MajorIndexNorthCount(path)
summary: Over each valley, the up steps up to and including its down step; summed.
catalog:
  - system: findstat
    identity: St001161
    url: https://www.findstat.org/St001161
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: MajorIndexNorthCount(path)
    description: Over each valley, the up steps up to and including its down step; summed.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
