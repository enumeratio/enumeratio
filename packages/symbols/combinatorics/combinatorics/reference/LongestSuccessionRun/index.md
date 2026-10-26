---
name: LongestSuccessionRun
domain: Permutation statistics
signature: LongestSuccessionRun(p)
summary: The length of the longest factor p(k), ..., p(l) with p(i+1) = p(i) + 1.
catalog:
  - system: findstat
    identity: St001652
    url: https://www.findstat.org/St001652
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: LongestSuccessionRun(p)
    description: The length of the longest factor p(k), ..., p(l) with p(i+1) = p(i) + 1.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- FindStat's St001662 reads the same, but its code miscounts runs that restart after a gap, so only St001652 is matched.
