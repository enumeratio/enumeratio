---
name: ExclusiveRightToLeftMinima
domain: Permutation statistics
signature: ExclusiveRightToLeftMinima(p)
summary: Right-to-left minima that are not left-to-right maxima.
catalog:
  - system: findstat
    identity: St000374
    url: https://www.findstat.org/St000374
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: ExclusiveRightToLeftMinima(p)
    description: Right-to-left minima that are not left-to-right maxima.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
