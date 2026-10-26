---
name: NeighboringNumber
domain: Permutation statistics
signature: NeighboringNumber(p)
summary: The smallest |p(i+1) - p(i)|, the wrap-around gap |p(1) - p(n)| included.
catalog:
  - system: findstat
    identity: St001344
    url: https://www.findstat.org/St001344
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NeighboringNumber(p)
    description: The smallest |p(i+1) - p(i)|, the wrap-around gap |p(1) - p(n)| included.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
