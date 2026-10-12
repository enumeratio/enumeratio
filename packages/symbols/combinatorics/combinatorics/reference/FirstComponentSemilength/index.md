---
name: FirstComponentSemilength
domain: Dyck path statistics
signature: FirstComponentSemilength(path)
summary: "The position of the first return to height 0, counted in up steps: half the steps of the first primitive component."
catalog:
  - system: findstat
    identity: St000026
    url: https://www.findstat.org/St000026
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: FirstComponentSemilength(path)
    description: "The position of the first return to height 0, counted in up steps: half the steps of the first primitive component."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's "position of the first return" counts up steps, not steps: UD is 1.
