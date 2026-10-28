---
name: VerticalSeparators
domain: Permutation statistics
signature: VerticalSeparators(p)
summary: Interior positions i with |p(i-1) - p(i+1)| = 1.
catalog:
  - system: findstat
    identity: St001403
    url: https://www.findstat.org/St001403
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: VerticalSeparators(p)
    description: Interior positions i with |p(i-1) - p(i+1)| = 1.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
