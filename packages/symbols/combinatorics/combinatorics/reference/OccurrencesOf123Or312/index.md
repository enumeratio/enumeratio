---
name: OccurrencesOf123Or312
domain: Permutation statistics
signature: OccurrencesOf123Or312(p)
summary: Triples ordered as 123 or as 312.
catalog:
  - system: findstat
    identity: St000430
    url: https://www.findstat.org/St000430
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf123Or312(p)
    description: Triples ordered as 123 or as 312.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
