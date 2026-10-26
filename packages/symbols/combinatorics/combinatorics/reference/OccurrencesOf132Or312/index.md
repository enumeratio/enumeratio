---
name: OccurrencesOf132Or312
domain: Permutation statistics
signature: OccurrencesOf132Or312(p)
summary: Triples ordered as 132 or as 312.
catalog:
  - system: findstat
    identity: St000426
    url: https://www.findstat.org/St000426
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf132Or312(p)
    description: Triples ordered as 132 or as 312.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
