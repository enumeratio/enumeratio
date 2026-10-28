---
name: MaximalDiagonalOccupancy
domain: Permutation statistics
signature: MaximalDiagonalOccupancy(p)
summary: "The most entries on one diagonal of the permutation matrix: the largest number of i sharing a p(i) - i."
catalog:
  - system: findstat
    identity: St000887
    url: https://www.findstat.org/St000887
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: MaximalDiagonalOccupancy(p)
    description: "The most entries on one diagonal of the permutation matrix: the largest number of i sharing a p(i) - i."
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
