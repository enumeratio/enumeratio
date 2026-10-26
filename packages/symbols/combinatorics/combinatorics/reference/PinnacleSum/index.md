---
name: PinnacleSum
domain: Permutation statistics
signature: PinnacleSum(p)
summary: "The sum of the peak values: p(i) over the interior peaks i."
catalog:
  - system: findstat
    identity: St001519
    url: https://www.findstat.org/St001519
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: PinnacleSum(p)
    description: "The sum of the peak values: p(i) over the interior peaks i."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
