---
name: OccurrencesOf123Or321
domain: Permutation statistics
signature: OccurrencesOf123Or321(p)
summary: Triples ordered as 123 or as 321.
catalog:
  - system: findstat
    identity: St000429
    url: https://www.findstat.org/St000429
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf123Or321(p)
    description: Triples ordered as 123 or as 321.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
