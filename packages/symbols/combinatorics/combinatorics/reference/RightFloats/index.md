---
name: RightFloats
domain: Permutation statistics
signature: RightFloats(p)
summary: Large ascents p(i+1) > p(i) + 1 beside no raft.
catalog:
  - system: findstat
    identity: St000663
    url: https://www.findstat.org/St000663
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: RightFloats(p)
    description: Large ascents p(i+1) > p(i) + 1 beside no raft.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- Rafts are the maximal runs of successions; a large ascent beside none of them floats.
