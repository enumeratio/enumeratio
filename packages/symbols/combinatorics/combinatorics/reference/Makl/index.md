---
name: Makl
domain: Permutation statistics
signature: Makl(p)
summary: "Foata and Zeilberger's makl: (1-32) + (31-2) + (32-1) + (21)."
catalog:
  - system: findstat
    identity: St000798
    url: https://www.findstat.org/St000798
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: Makl(p)
    description: "Foata and Zeilberger's makl: (1-32) + (31-2) + (32-1) + (21)."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
