---
name: MidPointsOfOccurrencesOf123
domain: Permutation statistics
signature: MidPointsOfOccurrencesOf123(p)
summary: Positions that are the middle of a 123 occurrence.
catalog:
  - system: findstat
    identity: St000372
    url: https://www.findstat.org/St000372
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: MidPointsOfOccurrencesOf123(p)
    description: Positions that are the middle of a 123 occurrence.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
