---
name: VisibleDescents
domain: Permutation statistics
signature: VisibleDescents(p)
summary: Positions i with p(i+1) <= min(i, p(i)).
catalog:
  - system: findstat
    identity: St001729
    url: https://www.findstat.org/St001729
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: VisibleDescents(p)
    description: Positions i with p(i+1) <= min(i, p(i)).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
