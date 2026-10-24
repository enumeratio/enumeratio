---
name: Recoils
domain: Permutation statistics
signature: Recoils(p)
summary: "Values i with i + 1 to the left of i: the descents of the inverse."
signatures:
  - call: Recoils(p)
    description: "Values i with i + 1 to the left of i: the descents of the inverse."
    library: enumeratio-combinatorics
    type: (permutation) -> number
catalog:
  - system: findstat
    identity: St000354
    url: https://www.findstat.org/St000354
    on: Permutation
statOn:
  - Permutation
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
