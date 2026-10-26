---
name: DoubleSuccessions
domain: Permutation statistics
signature: DoubleSuccessions(p)
summary: Positions i with p(i+1) = p(i) + 1 and p(i+2) = p(i) + 2.
catalog:
  - system: findstat
    identity: St001130
    url: https://www.findstat.org/St001130
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: DoubleSuccessions(p)
    description: Positions i with p(i+1) = p(i) + 1 and p(i+2) = p(i) + 2.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
