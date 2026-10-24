---
name: OccurrencesOf1324
domain: Permutation statistics
signature: OccurrencesOf1324(p)
summary: Quadruples i < j < k < l ordered as 1324.
signatures:
  - call: OccurrencesOf1324(p)
    description: Quadruples i < j < k < l ordered as 1324.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
catalog:
  - system: findstat
    identity: St000405
    url: https://www.findstat.org/St000405
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
