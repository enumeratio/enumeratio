---
name: OccurrencesOf52341
domain: Permutation statistics
signature: OccurrencesOf52341(p)
summary: Quintuples i < j < k < l < m ordered as 52341.
catalog:
  - system: findstat
    identity: St000623
    url: https://www.findstat.org/St000623
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf52341(p)
    description: Quintuples i < j < k < l < m ordered as 52341.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- Avoiding it is necessary for the Schubert variety to have a complete parabolic bundle structure.
