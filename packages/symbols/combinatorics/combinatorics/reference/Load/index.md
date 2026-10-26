---
name: Load
domain: Permutation statistics
signature: Load(p)
summary: The major index of the reverse of the inverse.
catalog:
  - system: findstat
    identity: St000304
    url: https://www.findstat.org/St000304
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: Load(p)
    description: The major index of the reverse of the inverse.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
