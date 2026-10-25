---
name: NonCyclicSmallExcedances
domain: Permutation statistics
signature: NonCyclicSmallExcedances(p)
summary: Positions that are not cyclic small excedances.
catalog:
  - system: findstat
    identity: St000235
    url: https://www.findstat.org/St000235
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NonCyclicSmallExcedances(p)
    description: Positions that are not cyclic small excedances.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
