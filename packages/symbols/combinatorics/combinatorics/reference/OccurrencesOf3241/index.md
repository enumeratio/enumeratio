---
name: OccurrencesOf3241
domain: Permutation statistics
signature: OccurrencesOf3241(p)
summary: Quadruples i < j < k < l ordered as 3241.
catalog:
  - system: findstat
    identity: St000406
    url: https://www.findstat.org/St000406
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf3241(p)
    description: Quadruples i < j < k < l ordered as 3241.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
