---
name: UlamDistance
domain: Permutation statistics
signature: UlamDistance(p)
summary: "The entries to remove to leave an increasing sequence: n less the length of a longest increasing subsequence."
catalog:
  - system: findstat
    identity: St000829
    url: https://www.findstat.org/St000829
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: UlamDistance(p)
    description: "The entries to remove to leave an increasing sequence: n less the length of a longest increasing subsequence."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- FindStat takes the longest increasing subsequence of the inverse, which has the same length.
