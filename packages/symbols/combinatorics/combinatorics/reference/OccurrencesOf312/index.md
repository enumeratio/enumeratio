---
name: OccurrencesOf312
domain: Permutation statistics
signature: OccurrencesOf312(p)
summary: Triples i < j < k with p(j) < p(k) < p(i).
catalog:
  - system: findstat
    identity: St000217
    url: https://www.findstat.org/St000217
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf312(p)
    description: Triples i < j < k with p(j) < p(k) < p(i).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
