---
name: InitialRise
domain: Dyck path statistics
signature: InitialRise(path)
summary: The length of the opening run of up steps.
statOn:
  - DyckPath
signatures:
  - call: InitialRise(path)
    description: The length of the opening run of up steps.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("DyckPath", $1, "InitialRise")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
catalog:
  - system: findstat
    identity: St000025
    url: https://www.findstat.org/St000025
    on: DyckPath
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Height equals the index exactly while every step so far has been an up step.
