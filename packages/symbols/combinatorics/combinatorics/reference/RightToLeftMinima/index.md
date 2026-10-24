---
name: RightToLeftMinima
domain: Permutation statistics
signature: RightToLeftMinima(p)
summary: Positions smaller than everything after them.
statOn:
  - Permutation
signatures:
  - call: RightToLeftMinima(p)
    description: Positions smaller than everything after them.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "RightToLeftMinima")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
catalog:
  - system: findstat
    identity: St000991
    url: https://www.findstat.org/St000991
    on: Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
