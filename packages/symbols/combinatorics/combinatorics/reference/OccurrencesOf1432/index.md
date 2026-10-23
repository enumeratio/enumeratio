---
name: OccurrencesOf1432
domain: Permutation statistics
signature: OccurrencesOf1432(p)
summary: Quadruples i < j < k < l ordered as 1432.
signatures:
  - call: OccurrencesOf1432(p)
    description: Quadruples i < j < k < l ordered as 1432.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
catalog:
  - system: findstat
    identity: St001847
    url: https://www.findstat.org/St001847
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
