---
name: AugmentedDoubleAscents
domain: Permutation statistics
signature: AugmentedDoubleAscents(p)
summary: Positions i with w(i) < w(i+1) < w(i+2) in the word w = 0 p(1) ... p(n).
catalog:
  - system: findstat
    identity: St001948
    url: https://www.findstat.org/St001948
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: AugmentedDoubleAscents(p)
    description: Positions i with w(i) < w(i+1) < w(i+2) in the word w = 0 p(1) ... p(n).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
