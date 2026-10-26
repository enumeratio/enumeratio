---
name: NonInitialLeftToRightMinima
domain: Permutation statistics
signature: NonInitialLeftToRightMinima(p)
summary: Positions i >= 2 with p(i) smaller than everything before it.
catalog:
  - system: findstat
    identity: St000541
    url: https://www.findstat.org/St000541
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NonInitialLeftToRightMinima(p)
    description: Positions i >= 2 with p(i) smaller than everything before it.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- FindStat's title speaks of indices with all smaller indices to the right; its code counts these, one less than LeftToRightMinima.
