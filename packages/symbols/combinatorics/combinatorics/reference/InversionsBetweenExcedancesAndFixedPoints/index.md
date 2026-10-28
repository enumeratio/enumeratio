---
name: InversionsBetweenExcedancesAndFixedPoints
domain: Permutation statistics
signature: InversionsBetweenExcedancesAndFixedPoints(p)
summary: Pairs i < j = p(j) < p(i).
catalog:
  - system: findstat
    identity: St001552
    url: https://www.findstat.org/St001552
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: InversionsBetweenExcedancesAndFixedPoints(p)
    description: Pairs i < j = p(j) < p(i).
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
