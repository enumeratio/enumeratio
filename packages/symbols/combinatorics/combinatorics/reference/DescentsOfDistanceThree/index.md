---
name: DescentsOfDistanceThree
domain: Permutation statistics
signature: DescentsOfDistanceThree(p)
summary: Positions i with p(i) > p(i+3).
catalog:
  - system: findstat
    identity: St001520
    url: https://www.findstat.org/St001520
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: DescentsOfDistanceThree(p)
    description: Positions i with p(i) > p(i+3).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
