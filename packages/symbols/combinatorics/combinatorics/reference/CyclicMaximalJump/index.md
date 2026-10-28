---
name: CyclicMaximalJump
domain: Permutation statistics
signature: CyclicMaximalJump(p)
summary: The largest |p(i+1) - p(i)|, with p(n+1) = p(1).
catalog:
  - system: findstat
    identity: St001245
    url: https://www.findstat.org/St001245
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: CyclicMaximalJump(p)
    description: The largest |p(i+1) - p(i)|, with p(n+1) = p(1).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
