---
name: BabsonSteingrimssonStatistic
domain: Permutation statistics
signature: BabsonSteingrimssonStatistic(p)
summary: "Babson and Steingrimsson's stat: (13-2) + (21-3) + (32-1) + (21)."
catalog:
  - system: findstat
    identity: St000692
    url: https://www.findstat.org/St000692
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: BabsonSteingrimssonStatistic(p)
    description: "Babson and Steingrimsson's stat: (13-2) + (21-3) + (32-1) + (21)."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
