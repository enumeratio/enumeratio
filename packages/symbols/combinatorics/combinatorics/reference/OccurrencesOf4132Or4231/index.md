---
name: OccurrencesOf4132Or4231
domain: Permutation statistics
signature: OccurrencesOf4132Or4231(p)
summary: Quadruples ordered as 4132 or as 4231.
catalog:
  - system: findstat
    identity: St000440
    url: https://www.findstat.org/St000440
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf4132Or4231(p)
    description: Quadruples ordered as 4132 or as 4231.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
