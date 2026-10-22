---
name: OccurrencesOf4231
domain: Permutation statistics
signature: OccurrencesOf4231(p)
summary: Quadruples i < j < k < l ordered as 4231.
signatures:
  - call: OccurrencesOf4231(p)
    description: Quadruples i < j < k < l ordered as 4231.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
