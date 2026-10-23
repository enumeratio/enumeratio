---
name: LeftToRightMinima
domain: Permutation statistics
signature: LeftToRightMinima(p)
summary: Positions smaller than everything before them.
statOn:
  - Permutation
signatures:
  - call: LeftToRightMinima(p)
    description: Positions smaller than everything before them.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "LeftToRightMinima")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
catalog:
  - system: findstat
    identity: St000542
    url: https://www.findstat.org/St000542
    on: Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
