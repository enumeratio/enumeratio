---
name: InverseMajorIndex
domain: Permutation statistics
signature: InverseMajorIndex(p)
summary: "The major index of the inverse: the sum of the values v with v + 1 to the left of v."
catalog:
  - system: findstat
    identity: St000305
    url: https://www.findstat.org/St000305
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: InverseMajorIndex(p)
    description: "The major index of the inverse: the sum of the values v with v + 1 to the left of v."
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
