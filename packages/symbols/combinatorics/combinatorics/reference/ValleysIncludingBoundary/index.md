---
name: ValleysIncludingBoundary
domain: Permutation statistics
signature: ValleysIncludingBoundary(p)
summary: Positions lower than both neighbours, a larger entry standing off each end.
catalog:
  - system: findstat
    identity: St000099
    url: https://www.findstat.org/St000099
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: ValleysIncludingBoundary(p)
    description: Positions lower than both neighbours, a larger entry standing off each end.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Excluding the boundary is Valleys.
