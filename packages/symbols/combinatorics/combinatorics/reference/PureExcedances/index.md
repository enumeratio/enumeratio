---
name: PureExcedances
domain: Permutation statistics
signature: PureExcedances(p)
summary: Excedances i < p(i) with no j < i where i <= p(j) < p(i).
signatures:
  - call: PureExcedances(p)
    description: Excedances i < p(i) with no j < i where i <= p(j) < p(i).
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
