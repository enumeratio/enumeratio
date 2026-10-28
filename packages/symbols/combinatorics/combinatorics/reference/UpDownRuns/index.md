---
name: UpDownRuns
domain: Permutation statistics
signature: UpDownRuns(p)
summary: Maximal monotone runs, with p(1) counted alone when it is a descent.
catalog:
  - system: findstat
    identity: St000638
    url: https://www.findstat.org/St000638
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: UpDownRuns(p)
    description: Maximal monotone runs, with p(1) counted alone when it is a descent.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
