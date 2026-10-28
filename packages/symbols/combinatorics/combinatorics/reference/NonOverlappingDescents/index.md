---
name: NonOverlappingDescents
domain: Permutation statistics
signature: NonOverlappingDescents(p)
summary: Descents taken greedily left to right, none starting where the last one ended.
catalog:
  - system: findstat
    identity: St001928
    url: https://www.findstat.org/St001928
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NonOverlappingDescents(p)
    description: Descents taken greedily left to right, none starting where the last one ended.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- Each maximal descending run of length m contributes floor(m / 2).
