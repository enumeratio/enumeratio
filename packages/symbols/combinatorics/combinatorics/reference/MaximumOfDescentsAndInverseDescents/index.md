---
name: MaximumOfDescentsAndInverseDescents
domain: Permutation statistics
signature: MaximumOfDescentsAndInverseDescents(p)
summary: The larger of the number of descents and the number of inverse descents.
catalog:
  - system: findstat
    identity: St001489
    url: https://www.findstat.org/St001489
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: MaximumOfDescentsAndInverseDescents(p)
    description: The larger of the number of descents and the number of inverse descents.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
