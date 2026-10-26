---
name: OccurrencesOf312Or321
domain: Permutation statistics
signature: OccurrencesOf312Or321(p)
summary: Triples ordered as 312 or as 321.
catalog:
  - system: findstat
    identity: St000437
    url: https://www.findstat.org/St000437
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf312Or321(p)
    description: Triples ordered as 312 or as 321.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
