---
name: MaximalDisplacement
domain: Permutation statistics
signature: MaximalDisplacement(p)
summary: The largest |p(i) - i|.
catalog:
  - system: findstat
    identity: St000956
    url: https://www.findstat.org/St000956
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: MaximalDisplacement(p)
    description: The largest |p(i) - i|.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
