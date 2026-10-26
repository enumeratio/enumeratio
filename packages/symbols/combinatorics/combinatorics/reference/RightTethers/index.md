---
name: RightTethers
domain: Permutation statistics
signature: RightTethers(p)
summary: Large ascents between two rafts.
catalog:
  - system: findstat
    identity: St000666
    url: https://www.findstat.org/St000666
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: RightTethers(p)
    description: Large ascents between two rafts.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
