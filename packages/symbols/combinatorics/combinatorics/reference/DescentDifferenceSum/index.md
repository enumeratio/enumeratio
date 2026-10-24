---
name: DescentDifferenceSum
domain: Permutation statistics
signature: DescentDifferenceSum(p)
summary: The sum of p(i) - p(i+1) over the descents i.
signatures:
  - call: DescentDifferenceSum(p)
    description: The sum of p(i) - p(i+1) over the descents i.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
catalog:
  - system: findstat
    identity: St000030
    url: https://www.findstat.org/St000030
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- Also called the drop of a permutation.
