---
name: RightToLeftMaxima
domain: Permutation statistics
signature: RightToLeftMaxima(p)
summary: Positions larger than everything after them.
statOn:
  - Permutation
signatures:
  - call: RightToLeftMaxima(p)
    description: Positions larger than everything after them.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "RightToLeftMaxima")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
