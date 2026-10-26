---
name: CyclesOfLengthAtMostTwo
domain: Permutation statistics
signature: CyclesOfLengthAtMostTwo(p)
summary: Cycles of size one or two.
catalog:
  - system: findstat
    identity: St000488
    url: https://www.findstat.org/St000488
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: CyclesOfLengthAtMostTwo(p)
    description: Cycles of size one or two.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
