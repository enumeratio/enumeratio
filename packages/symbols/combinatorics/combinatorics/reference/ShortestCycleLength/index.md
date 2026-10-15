---
name: ShortestCycleLength
domain: Permutation statistics
signature: ShortestCycleLength(p)
summary: The size of the smallest cycle.
catalog:
  - system: findstat
    identity: St000487
    url: https://www.findstat.org/St000487
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: ShortestCycleLength(p)
    description: The size of the smallest cycle.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
