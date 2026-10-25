---
name: NonSmallExcedances
domain: Permutation statistics
signature: NonSmallExcedances(p)
summary: Positions with p(i) != i + 1.
catalog:
  - system: findstat
    identity: St000240
    url: https://www.findstat.org/St000240
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NonSmallExcedances(p)
    description: Positions with p(i) != i + 1.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
