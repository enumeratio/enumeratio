---
name: PermutationNestings
domain: Permutation statistics
signature: PermutationNestings(p)
summary: Pairs i, j with j < i < p(i) < p(j) or p(j) < p(i) <= i < j.
catalog:
  - system: findstat
    identity: St000223
    url: https://www.findstat.org/St000223
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: PermutationNestings(p)
    description: Pairs i, j with j < i < p(i) < p(j) or p(j) < p(i) <= i < j.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Nestings of the arcs of the permutation diagram; set partitions have Nestings.
