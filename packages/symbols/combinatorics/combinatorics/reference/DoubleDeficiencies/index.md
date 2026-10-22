---
name: DoubleDeficiencies
domain: Permutation statistics
signature: DoubleDeficiencies(p)
summary: Positions with i > p(i) > p(p(i)).
signatures:
  - call: DoubleDeficiencies(p)
    description: Positions with i > p(i) > p(p(i)).
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
