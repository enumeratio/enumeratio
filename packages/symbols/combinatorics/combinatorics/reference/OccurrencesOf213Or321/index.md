---
name: OccurrencesOf213Or321
domain: Permutation statistics
signature: OccurrencesOf213Or321(p)
summary: Triples ordered as 213 or as 321.
catalog:
  - system: findstat
    identity: St000431
    url: https://www.findstat.org/St000431
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf213Or321(p)
    description: Triples ordered as 213 or as 321.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
