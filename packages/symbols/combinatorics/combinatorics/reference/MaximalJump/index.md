---
name: MaximalJump
domain: Permutation statistics
signature: MaximalJump(p)
summary: The largest |p(i+1) - p(i)|.
catalog:
  - system: findstat
    identity: St001246
    url: https://www.findstat.org/St001246
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: MaximalJump(p)
    description: The largest |p(i+1) - p(i)|.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
