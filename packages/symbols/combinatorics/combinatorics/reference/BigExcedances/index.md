---
name: BigExcedances
domain: Permutation statistics
signature: BigExcedances(p)
summary: Positions with p(i) - i > 1.
signatures:
  - call: BigExcedances(p)
    description: Positions with p(i) - i > 1.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
