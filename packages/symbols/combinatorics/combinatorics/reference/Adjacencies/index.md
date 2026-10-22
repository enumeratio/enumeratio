---
name: Adjacencies
domain: Permutation statistics
signature: Adjacencies(p)
summary: Positions i with p(i+1) = p(i) - 1.
signatures:
  - call: Adjacencies(p)
    description: Positions i with p(i+1) = p(i) - 1.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- Also called small descents.
