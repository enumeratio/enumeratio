---
name: OccurrencesOf4213
domain: Permutation statistics
signature: OccurrencesOf4213(p)
summary: Quadruples i < j < k < l ordered as 4213.
catalog:
  - system: findstat
    identity: St000750
    url: https://www.findstat.org/St000750
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf4213(p)
    description: Quadruples i < j < k < l ordered as 4213.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
