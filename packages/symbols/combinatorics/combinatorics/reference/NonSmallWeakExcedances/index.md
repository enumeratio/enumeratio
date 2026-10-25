---
name: NonSmallWeakExcedances
domain: Permutation statistics
signature: NonSmallWeakExcedances(p)
summary: Positions with p(i) not in {i, i + 1}.
catalog:
  - system: findstat
    identity: St000238
    url: https://www.findstat.org/St000238
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: NonSmallWeakExcedances(p)
    description: Positions with p(i) not in {i, i + 1}.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
