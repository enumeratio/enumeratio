---
name: AdjacentCycles
domain: Permutation statistics
signature: AdjacentCycles(p)
summary: Cycles of the form (a, a+1, ..., a+k), fixed points included.
catalog:
  - system: findstat
    identity: St000153
    url: https://www.findstat.org/St000153
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: AdjacentCycles(p)
    description: Cycles of the form (a, a+1, ..., a+k), fixed points included.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
