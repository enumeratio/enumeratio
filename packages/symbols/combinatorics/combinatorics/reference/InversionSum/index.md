---
name: InversionSum
domain: Permutation statistics
signature: InversionSum(p)
summary: The sum of j - i over the inversions i < j.
catalog:
  - system: findstat
    identity: St000055
    url: https://www.findstat.org/St000055
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: InversionSum(p)
    description: The sum of j - i over the inversions i < j.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
