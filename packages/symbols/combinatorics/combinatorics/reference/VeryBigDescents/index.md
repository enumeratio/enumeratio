---
name: VeryBigDescents
domain: Permutation statistics
signature: VeryBigDescents(p)
summary: Positions i with p(i) - p(i+1) > 2.
signatures:
  - call: VeryBigDescents(p)
    description: Positions i with p(i) - p(i+1) > 2.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
