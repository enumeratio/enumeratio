---
name: GreaterNeighborOfMaximum
domain: Permutation statistics
signature: GreaterNeighborOfMaximum(p)
summary: The larger of the two entries beside n, an end counting as 0.
catalog:
  - system: findstat
    identity: St000060
    url: https://www.findstat.org/St000060
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: GreaterNeighborOfMaximum(p)
    description: The larger of the two entries beside n, an end counting as 0.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
