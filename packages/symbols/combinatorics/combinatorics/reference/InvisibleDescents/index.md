---
name: InvisibleDescents
domain: Permutation statistics
signature: InvisibleDescents(p)
summary: Positions i with p(i) > p(i+1) > i.
catalog:
  - system: findstat
    identity: St001728
    url: https://www.findstat.org/St001728
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: InvisibleDescents(p)
    description: Positions i with p(i) > p(i+1) > i.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
