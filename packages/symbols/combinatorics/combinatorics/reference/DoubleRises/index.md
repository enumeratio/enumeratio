---
name: DoubleRises
domain: Dyck path statistics
signature: DoubleRises(path)
summary: Occurrences of two consecutive up steps.
catalog:
  - system: findstat
    identity: St000024
    url: https://www.findstat.org/St000024
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: DoubleRises(path)
    description: Occurrences of two consecutive up steps.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("DyckPath", $1, "DoubleRises")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
