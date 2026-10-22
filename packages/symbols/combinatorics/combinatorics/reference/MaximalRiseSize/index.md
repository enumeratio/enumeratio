---
name: MaximalRiseSize
domain: Permutation statistics
signature: MaximalRiseSize(p)
summary: The largest p(i+1) - p(i), or 0 when p has no rise.
signatures:
  - call: MaximalRiseSize(p)
    description: The largest p(i+1) - p(i), or 0 when p has no rise.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
