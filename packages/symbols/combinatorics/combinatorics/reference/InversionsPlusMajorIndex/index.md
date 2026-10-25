---
name: InversionsPlusMajorIndex
domain: Permutation statistics
signature: InversionsPlusMajorIndex(p)
summary: The number of inversions plus the major index.
catalog:
  - system: findstat
    identity: St001379
    url: https://www.findstat.org/St001379
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: InversionsPlusMajorIndex(p)
    description: The number of inversions plus the major index.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
