---
name: OccurrencesOfInitial312
domain: Permutation statistics
signature: OccurrencesOfInitial312(p)
summary: Triples 1 < j < k ordered as 312 (|312).
catalog:
  - system: findstat
    identity: St000801
    url: https://www.findstat.org/St000801
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOfInitial312(p)
    description: Triples 1 < j < k ordered as 312 (|312).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
