---
name: LargestRunLength
domain: Permutation statistics
signature: LargestRunLength(p)
summary: The length of the longest increasing run (the catalog's second spelling of LongestRun).
statOn:
  - Permutation
signatures:
  - call: LargestRunLength(p)
    description: The length of the longest increasing run (the catalog's second spelling of LongestRun).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
