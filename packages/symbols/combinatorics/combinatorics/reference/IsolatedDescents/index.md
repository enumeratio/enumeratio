---
name: IsolatedDescents
domain: Permutation statistics
signature: IsolatedDescents(p)
summary: Descents i such that neither i-1 nor i+1 is a descent.
catalog:
  - system: findstat
    identity: St000884
    url: https://www.findstat.org/St000884
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: IsolatedDescents(p)
    description: Descents i such that neither i-1 nor i+1 is a descent.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
