---
name: OccurrencesOf23Dash1
domain: Permutation statistics
signature: OccurrencesOf23Dash1(p)
summary: Triples i, i+1, k with k > i+1 ordered as 231 (23-1).
catalog:
  - system: findstat
    identity: St000359
    url: https://www.findstat.org/St000359
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOf23Dash1(p)
    description: Triples i, i+1, k with k > i+1 ordered as 231 (23-1).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
