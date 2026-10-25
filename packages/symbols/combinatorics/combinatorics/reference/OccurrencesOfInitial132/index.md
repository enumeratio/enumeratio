---
name: OccurrencesOfInitial132
domain: Permutation statistics
signature: OccurrencesOfInitial132(p)
summary: Triples 1 < j < k ordered as 132 (|132).
catalog:
  - system: findstat
    identity: St000803
    url: https://www.findstat.org/St000803
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOfInitial132(p)
    description: Triples 1 < j < k ordered as 132 (|132).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
