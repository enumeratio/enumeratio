---
name: ElizaldePakRank
domain: Permutation statistics
signature: ElizaldePakRank(p)
summary: The largest k with p(i) > k for all i <= k.
catalog:
  - system: findstat
    identity: St000352
    url: https://www.findstat.org/St000352
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: ElizaldePakRank(p)
    description: The largest k with p(i) > k for all i <= k.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Read as FindStat's code does: the first k that fails, less one.
