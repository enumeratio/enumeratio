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
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
