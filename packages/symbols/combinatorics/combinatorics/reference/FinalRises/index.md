---
name: FinalRises
domain: Permutation statistics
signature: FinalRises(p)
summary: "The ascents at the end: n - 1 less the last descent position."
catalog:
  - system: findstat
    identity: St000989
    url: https://www.findstat.org/St000989
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: FinalRises(p)
    description: "The ascents at the end: n - 1 less the last descent position."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
