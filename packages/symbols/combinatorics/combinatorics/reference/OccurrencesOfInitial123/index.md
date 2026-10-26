---
name: OccurrencesOfInitial123
domain: Permutation statistics
signature: OccurrencesOfInitial123(p)
summary: Triples 1 < j < k ordered as 123 (|123).
catalog:
  - system: findstat
    identity: St000804
    url: https://www.findstat.org/St000804
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOfInitial123(p)
    description: Triples 1 < j < k ordered as 123 (|123).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
