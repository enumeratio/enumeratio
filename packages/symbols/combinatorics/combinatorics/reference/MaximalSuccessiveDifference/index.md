---
name: MaximalSuccessiveDifference
domain: Permutation statistics
signature: MaximalSuccessiveDifference(p)
summary: The largest p(i+1) - p(i), negative for a decreasing permutation.
catalog:
  - system: findstat
    identity: St000652
    url: https://www.findstat.org/St000652
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: MaximalSuccessiveDifference(p)
    description: The largest p(i+1) - p(i), negative for a decreasing permutation.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- MaximalRiseSize is the same with a floor of 0.
