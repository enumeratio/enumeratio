---
name: TwoShiftedMajorIndex
domain: Permutation statistics
signature: TwoShiftedMajorIndex(p)
summary: The sum of the positions i with p(i) - p(i+1) > 2.
catalog:
  - system: findstat
    identity: St000963
    url: https://www.findstat.org/St000963
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: TwoShiftedMajorIndex(p)
    description: The sum of the positions i with p(i) - p(i+1) > 2.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- ShiftedMajorIndex is the same with a gap of more than 1.
