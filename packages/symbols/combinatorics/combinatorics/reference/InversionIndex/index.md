---
name: InversionIndex
domain: Permutation statistics
signature: InversionIndex(p)
summary: The sum of the larger entry p(i) over the inversions i < j.
catalog:
  - system: findstat
    identity: St000616
    url: https://www.findstat.org/St000616
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: InversionIndex(p)
    description: The sum of the larger entry p(i) over the inversions i < j.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
