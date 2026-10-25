---
name: OccurrencesOfInitial231
domain: Permutation statistics
signature: OccurrencesOfInitial231(p)
summary: Triples 1 < j < k ordered as 231 (|231).
catalog:
  - system: findstat
    identity: St000800
    url: https://www.findstat.org/St000800
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOfInitial231(p)
    description: Triples 1 < j < k ordered as 231 (|231).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
