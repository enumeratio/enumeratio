---
name: OccurrencesOf231
domain: Permutation statistics
signature: OccurrencesOf231(p)
summary: Triples i < j < k with p(k) < p(i) < p(j).
catalog:
  - system: findstat
    identity: St000219
    url: https://www.findstat.org/St000219
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf231(p)
    description: Triples i < j < k with p(k) < p(i) < p(j).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
