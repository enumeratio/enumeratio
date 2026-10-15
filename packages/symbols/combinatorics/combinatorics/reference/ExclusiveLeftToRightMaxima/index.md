---
name: ExclusiveLeftToRightMaxima
domain: Permutation statistics
signature: ExclusiveLeftToRightMaxima(p)
summary: Left-to-right maxima that are not right-to-left minima.
catalog:
  - system: findstat
    identity: St000996
    url: https://www.findstat.org/St000996
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: ExclusiveLeftToRightMaxima(p)
    description: Left-to-right maxima that are not right-to-left minima.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
