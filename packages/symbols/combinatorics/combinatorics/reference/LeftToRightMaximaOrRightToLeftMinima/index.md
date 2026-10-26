---
name: LeftToRightMaximaOrRightToLeftMinima
domain: Permutation statistics
signature: LeftToRightMaximaOrRightToLeftMinima(p)
summary: Positions that are a left-to-right maximum, a right-to-left minimum, or both.
catalog:
  - system: findstat
    identity: St001004
    url: https://www.findstat.org/St001004
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: LeftToRightMaximaOrRightToLeftMinima(p)
    description: Positions that are a left-to-right maximum, a right-to-left minimum, or both.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
