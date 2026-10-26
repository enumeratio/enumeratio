---
name: DescentsAfterZeroingFixedPoints
domain: Permutation statistics
signature: DescentsAfterZeroingFixedPoints(p)
summary: The descents of the word with every fixed point replaced by 0.
catalog:
  - system: findstat
    identity: St000333
    url: https://www.findstat.org/St000333
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: DescentsAfterZeroingFixedPoints(p)
    description: The descents of the word with every fixed point replaced by 0.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
