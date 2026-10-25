---
name: OccurrencesOfInitial2Dash13
domain: Permutation statistics
signature: OccurrencesOfInitial2Dash13(p)
summary: Triples 1, j, j+1 ordered as 213 (|2-13).
catalog:
  - system: findstat
    identity: St001085
    url: https://www.findstat.org/St001085
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOfInitial2Dash13(p)
    description: Triples 1, j, j+1 ordered as 213 (|2-13).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- FindStat titles this |21-3.
