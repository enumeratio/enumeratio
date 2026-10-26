---
name: Rafts
domain: Permutation statistics
signature: Rafts(p)
summary: Maximal runs of consecutive successions p(i+1) = p(i) + 1.
catalog:
  - system: findstat
    identity: St000665
    url: https://www.findstat.org/St000665
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: Rafts(p)
    description: Maximal runs of consecutive successions p(i+1) = p(i) + 1.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
