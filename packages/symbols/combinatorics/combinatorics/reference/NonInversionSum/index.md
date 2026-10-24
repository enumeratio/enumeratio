---
name: NonInversionSum
domain: Permutation statistics
signature: NonInversionSum(p)
summary: The sum of j - i over the non-inversions i < j.
signatures:
  - call: NonInversionSum(p)
    description: The sum of j - i over the non-inversions i < j.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
catalog:
  - system: findstat
    identity: St000341
    url: https://www.findstat.org/St000341
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
