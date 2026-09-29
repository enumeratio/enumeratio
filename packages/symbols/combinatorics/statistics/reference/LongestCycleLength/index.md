---
name: LongestCycleLength
domain: Permutation statistics
signature: LongestCycleLength(p)
summary: The size of the largest cycle (the catalog's second spelling).
statOn:
  - Permutation
signatures:
  - call: LongestCycleLength(p)
    description: The size of the largest cycle (the catalog's second spelling).
    library: enumeratio-statistics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
