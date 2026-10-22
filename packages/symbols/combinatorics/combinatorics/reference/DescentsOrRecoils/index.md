---
name: DescentsOrRecoils
domain: Permutation statistics
signature: DescentsOrRecoils(p)
summary: Indices i < n that are a descent of p or a recoil.
signatures:
  - call: DescentsOrRecoils(p)
    description: Indices i < n that are a descent of p or a recoil.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
