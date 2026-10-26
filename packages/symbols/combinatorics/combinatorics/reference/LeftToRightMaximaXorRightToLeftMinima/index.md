---
name: LeftToRightMaximaXorRightToLeftMinima
domain: Permutation statistics
signature: LeftToRightMaximaXorRightToLeftMinima(p)
summary: Positions that are a left-to-right maximum or a right-to-left minimum but not both.
catalog:
  - system: findstat
    identity: St001005
    url: https://www.findstat.org/St001005
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: LeftToRightMaximaXorRightToLeftMinima(p)
    description: Positions that are a left-to-right maximum or a right-to-left minimum but not both.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
