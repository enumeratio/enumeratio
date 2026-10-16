---
name: RunsOfLengthOne
domain: Dyck path statistics
signature: RunsOfLengthOne(path)
summary: Maximal runs of equal steps that are a single step.
catalog:
  - system: findstat
    identity: St001669
    url: https://www.findstat.org/St001669
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: RunsOfLengthOne(path)
    description: Maximal runs of equal steps that are a single step.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
