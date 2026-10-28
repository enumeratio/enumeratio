---
name: MaximalModularDisplacement
domain: Permutation statistics
signature: MaximalModularDisplacement(p)
summary: The largest cyclic distance between p(i) and i, taken mod n.
catalog:
  - system: findstat
    identity: St001569
    url: https://www.findstat.org/St001569
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: MaximalModularDisplacement(p)
    description: The largest cyclic distance between p(i) and i, taken mod n.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
