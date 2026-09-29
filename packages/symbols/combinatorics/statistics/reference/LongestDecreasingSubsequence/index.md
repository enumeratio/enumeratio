---
name: LongestDecreasingSubsequence
domain: Permutation statistics
signature: LongestDecreasingSubsequence(p)
summary: The length of a longest decreasing subsequence.
references:
  - system: wikipedia
    identity: Longest increasing subsequence
statOn:
  - Permutation
signatures:
  - call: LongestDecreasingSubsequence(p)
    description: The length of a longest decreasing subsequence.
    library: enumeratio-statistics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- The same fold with the comparison reversed — by Dilworth, the number of piles when the tops are kept decreasing.
