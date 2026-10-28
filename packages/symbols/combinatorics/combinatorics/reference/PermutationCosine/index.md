---
name: PermutationCosine
domain: Permutation statistics
signature: PermutationCosine(p)
summary: The sum of i p(i).
catalog:
  - system: findstat
    identity: St000342
    url: https://www.findstat.org/St000342
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: PermutationCosine(p)
    description: The sum of i p(i).
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The scalar product of p with the identity: n(n+1)(2n+1) / 6 times the cosine of the angle between them.
