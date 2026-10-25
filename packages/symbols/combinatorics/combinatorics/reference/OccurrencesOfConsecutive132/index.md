---
name: OccurrencesOfConsecutive132
domain: Permutation statistics
signature: OccurrencesOfConsecutive132(p)
summary: Triples i, i+1, i+2 ordered as 132 (consecutive 132).
catalog:
  - system: findstat
    identity: St001086
    url: https://www.findstat.org/St001086
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OccurrencesOfConsecutive132(p)
    description: Triples i, i+1, i+2 ordered as 132 (consecutive 132).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
