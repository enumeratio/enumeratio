---
name: OccurrencesOf13Dash2
domain: Permutation statistics
signature: OccurrencesOf13Dash2(p)
summary: Triples i, i+1, k with k > i+1 ordered as 132 (13-2).
catalog:
  - system: findstat
    identity: St000356
    url: https://www.findstat.org/St000356
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf13Dash2(p)
    description: Triples i, i+1, k with k > i+1 ordered as 132 (13-2).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
