---
name: DescentsAndRecoils
domain: Permutation statistics
signature: DescentsAndRecoils(p)
summary: Indices i < n that are both a descent of p and a recoil.
catalog:
  - system: findstat
    identity: St001061
    url: https://www.findstat.org/St001061
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: DescentsAndRecoils(p)
    description: Indices i < n that are both a descent of p and a recoil.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
