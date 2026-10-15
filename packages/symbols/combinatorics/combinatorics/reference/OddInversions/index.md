---
name: OddInversions
domain: Permutation statistics
signature: OddInversions(p)
summary: Inversions i < j with j - i odd.
catalog:
  - system: findstat
    identity: St000539
    url: https://www.findstat.org/St000539
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OddInversions(p)
    description: Inversions i < j with j - i odd.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
