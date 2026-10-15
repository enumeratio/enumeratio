---
name: BigDescents
domain: Permutation statistics
signature: BigDescents(p)
summary: Positions i with p(i) - p(i+1) > 1.
catalog:
  - system: findstat
    identity: St000647
    url: https://www.findstat.org/St000647
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: BigDescents(p)
    description: Positions i with p(i) - p(i+1) > 1.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
