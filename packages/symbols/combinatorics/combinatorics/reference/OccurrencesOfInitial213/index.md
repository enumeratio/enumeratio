---
name: OccurrencesOfInitial213
domain: Permutation statistics
signature: OccurrencesOfInitial213(p)
summary: Triples 1 < j < k ordered as 213 (|213).
catalog:
  - system: findstat
    identity: St000799
    url: https://www.findstat.org/St000799
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOfInitial213(p)
    description: Triples 1 < j < k ordered as 213 (|213).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
