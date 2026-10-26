---
name: OccurrencesOfInitial12Dash3
domain: Permutation statistics
signature: OccurrencesOfInitial12Dash3(p)
summary: Triples 1, 2, k ordered as 123 (|12-3).
catalog:
  - system: findstat
    identity: St001084
    url: https://www.findstat.org/St001084
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOfInitial12Dash3(p)
    description: Triples 1, 2, k ordered as 123 (|12-3).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- FindStat titles this |1-23, but its definition matches p(1) and p(2) as adjacent.
