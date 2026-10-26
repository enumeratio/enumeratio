---
name: SmallestFixedPoint
domain: Permutation statistics
signature: SmallestFixedPoint(p)
summary: The smallest i with p(i) = i, or n + 1 when there is none.
catalog:
  - system: findstat
    identity: St001468
    url: https://www.findstat.org/St001468
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: SmallestFixedPoint(p)
    description: The smallest i with p(i) = i, or n + 1 when there is none.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
