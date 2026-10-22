---
name: OccurrencesOf2413
domain: Permutation statistics
signature: OccurrencesOf2413(p)
summary: Quadruples i < j < k < l ordered as 2413.
signatures:
  - call: OccurrencesOf2413(p)
    description: Quadruples i < j < k < l ordered as 2413.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
