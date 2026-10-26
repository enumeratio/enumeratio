---
name: RightRopes
domain: Permutation statistics
signature: RightRopes(p)
summary: Large ascents right after a raft.
catalog:
  - system: findstat
    identity: St000664
    url: https://www.findstat.org/St000664
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: RightRopes(p)
    description: Large ascents right after a raft.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
