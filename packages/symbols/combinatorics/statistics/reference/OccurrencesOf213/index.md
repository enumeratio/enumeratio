---
name: OccurrencesOf213
domain: Permutation statistics
signature: OccurrencesOf213(p)
summary: Triples i < j < k with p(j) < p(i) < p(k).
formerly:
  - NumberOfOccurrencesOf213
signatures:
  - call: OccurrencesOf213(p)
    description: Triples i < j < k with p(j) < p(i) < p(k).
    library: enumeratio-statistics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
