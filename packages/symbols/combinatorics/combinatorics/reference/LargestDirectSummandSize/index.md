---
name: LargestDirectSummandSize
domain: Permutation statistics
signature: LargestDirectSummandSize(p)
summary: The size of the largest block of p as a direct sum.
catalog:
  - system: findstat
    identity: St000844
    url: https://www.findstat.org/St000844
    on: Permutation
statOn:
  - Permutation
signatures:
  - call: LargestDirectSummandSize(p)
    description: The size of the largest block of p as a direct sum.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
