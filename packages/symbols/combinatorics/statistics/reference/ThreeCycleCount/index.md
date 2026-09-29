---
name: ThreeCycleCount
domain: Permutation statistics
signature: ThreeCycleCount(p)
summary: Cycles of size exactly three.
formerly:
  - NumberOfCyclesOfLength3
signatures:
  - call: ThreeCycleCount(p)
    description: Cycles of size exactly three.
    library: enumeratio-statistics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
