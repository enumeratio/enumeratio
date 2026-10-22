---
name: GlobalAscents
domain: Permutation statistics
signature: GlobalAscents(p)
summary: Positions i < n with p(j) < p(k) whenever j <= i < k.
signatures:
  - call: GlobalAscents(p)
    description: Positions i < n with p(j) < p(k) whenever j <= i < k.
    library: enumeratio-combinatorics
    type: (list<integer> | permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.
- Read through the pigeonhole principle: the largest of the first i entries is at most i.
