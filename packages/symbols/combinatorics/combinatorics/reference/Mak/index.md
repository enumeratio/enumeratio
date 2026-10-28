---
name: Mak
domain: Permutation statistics
signature: Mak(p)
summary: "Foata and Zeilberger's mak: (2-31) + (32-1) + (1-32) + (21)."
catalog:
  - system: findstat
    identity: St000794
    url: https://www.findstat.org/St000794
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: Mak(p)
    description: "Foata and Zeilberger's mak: (2-31) + (32-1) + (1-32) + (21)."
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
