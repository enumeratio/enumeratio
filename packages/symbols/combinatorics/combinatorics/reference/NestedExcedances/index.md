---
name: NestedExcedances
domain: Permutation statistics
signature: NestedExcedances(p)
summary: Pairs i < j with i < j < p(j) < p(i).
signatures:
  - call: NestedExcedances(p)
    description: Pairs i < j with i < j < p(j) < p(i).
    library: enumeratio-combinatorics
    type: (permutation) -> number
catalog:
  - system: findstat
    identity: St001513
    url: https://www.findstat.org/St001513
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
