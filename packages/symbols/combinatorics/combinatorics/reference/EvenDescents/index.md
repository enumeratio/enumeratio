---
name: EvenDescents
domain: Permutation statistics
signature: EvenDescents(p)
summary: Descents i with i even.
catalog:
  - system: findstat
    identity: St001115
    url: https://www.findstat.org/St001115
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: EvenDescents(p)
    description: Descents i with i even.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
