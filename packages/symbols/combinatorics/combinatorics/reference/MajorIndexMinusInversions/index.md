---
name: MajorIndexMinusInversions
domain: Permutation statistics
signature: MajorIndexMinusInversions(p)
summary: The major index less the number of inversions.
catalog:
  - system: findstat
    identity: St001377
    url: https://www.findstat.org/St001377
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: MajorIndexMinusInversions(p)
    description: The major index less the number of inversions.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
