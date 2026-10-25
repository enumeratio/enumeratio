---
name: CyclicSmallWeakExcedances
domain: Permutation statistics
signature: CyclicSmallWeakExcedances(p)
summary: Positions with p(i) = i or p(i) = i + 1, read cyclically.
catalog:
  - system: findstat
    identity: St000236
    url: https://www.findstat.org/St000236
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: CyclicSmallWeakExcedances(p)
    description: Positions with p(i) = i or p(i) = i + 1, read cyclically.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
