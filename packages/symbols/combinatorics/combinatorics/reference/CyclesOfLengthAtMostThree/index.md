---
name: CyclesOfLengthAtMostThree
domain: Permutation statistics
signature: CyclesOfLengthAtMostThree(p)
summary: Cycles of size at most three.
catalog:
  - system: findstat
    identity: St000489
    url: https://www.findstat.org/St000489
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: CyclesOfLengthAtMostThree(p)
    description: Cycles of size at most three.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
