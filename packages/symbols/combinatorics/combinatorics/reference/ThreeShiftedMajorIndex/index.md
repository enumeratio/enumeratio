---
name: ThreeShiftedMajorIndex
domain: Permutation statistics
signature: ThreeShiftedMajorIndex(p)
summary: The sum of the positions i with p(i) - p(i+1) > 3.
catalog:
  - system: findstat
    identity: St000962
    url: https://www.findstat.org/St000962
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: ThreeShiftedMajorIndex(p)
    description: The sum of the positions i with p(i) - p(i+1) > 3.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
