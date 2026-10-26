---
name: OddDescents
domain: Permutation statistics
signature: OddDescents(p)
summary: Descents i with i odd.
catalog:
  - system: findstat
    identity: St001114
    url: https://www.findstat.org/St001114
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: OddDescents(p)
    description: Descents i with i odd.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
