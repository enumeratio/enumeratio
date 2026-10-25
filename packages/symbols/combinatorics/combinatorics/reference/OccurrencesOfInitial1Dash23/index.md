---
name: OccurrencesOfInitial1Dash23
domain: Permutation statistics
signature: OccurrencesOfInitial1Dash23(p)
summary: Triples 1, j, j+1 ordered as 123 (|1-23).
catalog:
  - system: findstat
    identity: St001087
    url: https://www.findstat.org/St001087
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOfInitial1Dash23(p)
    description: Triples 1, j, j+1 ordered as 123 (|1-23).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- FindStat titles this |12-3.
