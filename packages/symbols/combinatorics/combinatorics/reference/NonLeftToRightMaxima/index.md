---
name: NonLeftToRightMaxima
domain: Permutation statistics
signature: NonLeftToRightMaxima(p)
summary: Positions smaller than something before them.
catalog:
  - system: findstat
    identity: St000316
    url: https://www.findstat.org/St000316
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NonLeftToRightMaxima(p)
    description: Positions smaller than something before them.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
