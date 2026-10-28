---
name: InversionsOfCyclicEmbedding
domain: Permutation statistics
signature: InversionsOfCyclicEmbedding(p)
summary: The inversions of the cycle (p(1), ..., p(n), n + 1), as a permutation of n + 1.
catalog:
  - system: findstat
    identity: St001074
    url: https://www.findstat.org/St001074
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: InversionsOfCyclicEmbedding(p)
    description: The inversions of the cycle (p(1), ..., p(n), n + 1), as a permutation of n + 1.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
