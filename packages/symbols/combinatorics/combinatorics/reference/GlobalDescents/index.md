---
name: GlobalDescents
domain: Permutation statistics
signature: GlobalDescents(p)
summary: Positions i < n with p(j) > p(k) whenever j <= i < k.
signatures:
  - call: GlobalDescents(p)
    description: Positions i < n with p(j) > p(k) whenever j <= i < k.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
catalog:
  - system: findstat
    identity: St000546
    url: https://www.findstat.org/St000546
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
