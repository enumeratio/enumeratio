---
name: Mad
domain: Permutation statistics
signature: Mad(p)
summary: "Foata and Zeilberger's mad: 2 (2-31) + (31-2) + (21)."
catalog:
  - system: findstat
    identity: St000795
    url: https://www.findstat.org/St000795
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: Mad(p)
    description: "Foata and Zeilberger's mad: 2 (2-31) + (31-2) + (21)."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
