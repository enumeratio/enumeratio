---
name: LargestCycleLength
domain: Permutation statistics
signature: LargestCycleLength(p)
summary: The size of the largest cycle.
statOn:
  - Permutation
signatures:
  - call: LargestCycleLength(p)
    description: The size of the largest cycle.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
