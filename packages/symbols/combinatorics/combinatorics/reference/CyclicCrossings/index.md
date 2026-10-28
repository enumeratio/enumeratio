---
name: CyclicCrossings
domain: Permutation statistics
signature: CyclicCrossings(p)
summary: Pairs (i, j) with i, p(j), p(i), j in cyclic order.
catalog:
  - system: findstat
    identity: St001537
    url: https://www.findstat.org/St001537
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: CyclicCrossings(p)
    description: Pairs (i, j) with i, p(j), p(i), j in cyclic order.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
