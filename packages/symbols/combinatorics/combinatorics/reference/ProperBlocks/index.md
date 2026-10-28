---
name: ProperBlocks
domain: Permutation statistics
signature: ProperBlocks(p)
summary: Windows p(i), ..., p(j) of two or more entries whose values are consecutive integers, the whole word excepted.
catalog:
  - system: findstat
    identity: St001160
    url: https://www.findstat.org/St001160
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: ProperBlocks(p)
    description: Windows p(i), ..., p(j) of two or more entries whose values are consecutive integers, the whole word excepted.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
