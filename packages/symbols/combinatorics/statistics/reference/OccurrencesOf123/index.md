---
name: OccurrencesOf123
domain: Permutation statistics
signature: OccurrencesOf123(p)
summary: Triples i < j < k with p(i) < p(j) < p(k).
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf123(p)
    description: Triples i < j < k with p(i) < p(j) < p(k).
    library: enumeratio-statistics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
