---
name: CyclesOfLengthAtLeastThree
domain: Permutation statistics
signature: CyclesOfLengthAtLeastThree(p)
summary: Cycles of size at least three.
signatures:
  - call: CyclesOfLengthAtLeastThree(p)
    description: Cycles of size at least three.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
