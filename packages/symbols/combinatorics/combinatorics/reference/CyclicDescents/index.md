---
name: CyclicDescents
domain: Permutation statistics
signature: CyclicDescents(p)
summary: Descents of p read cyclically, counting position n when p(n) > p(1).
statOn:
  - Permutation
signatures:
  - call: CyclicDescents(p)
    description: Descents of p read cyclically, counting position n when p(n) > p(1).
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
