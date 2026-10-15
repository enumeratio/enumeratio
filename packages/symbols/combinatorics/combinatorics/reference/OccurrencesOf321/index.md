---
name: OccurrencesOf321
domain: Permutation statistics
signature: OccurrencesOf321(p)
summary: Triples i < j < k with p(i) > p(j) > p(k).
catalog:
  - system: findstat
    identity: St000119
    url: https://www.findstat.org/St000119
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf321(p)
    description: Triples i < j < k with p(i) > p(j) > p(k).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
