---
name: StrongFixedPoints
domain: Permutation statistics
signature: StrongFixedPoints(p)
summary: Positions that are both a left-to-right maximum and a right-to-left minimum.
catalog:
  - system: findstat
    identity: St000221
    url: https://www.findstat.org/St000221
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: StrongFixedPoints(p)
    description: Positions that are both a left-to-right maximum and a right-to-left minimum.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
