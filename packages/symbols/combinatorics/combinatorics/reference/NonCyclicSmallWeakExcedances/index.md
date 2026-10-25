---
name: NonCyclicSmallWeakExcedances
domain: Permutation statistics
signature: NonCyclicSmallWeakExcedances(p)
summary: Positions that are not cyclic small weak excedances.
catalog:
  - system: findstat
    identity: St000242
    url: https://www.findstat.org/St000242
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NonCyclicSmallWeakExcedances(p)
    description: Positions that are not cyclic small weak excedances.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
