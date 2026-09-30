---
name: TwoCycleCount
domain: Permutation statistics
signature: TwoCycleCount(p)
summary: Cycles of size exactly two.
formerly:
  - NumberOfCyclesOfLength2
signatures:
  - call: TwoCycleCount(p)
    description: Cycles of size exactly two.
    library: enumeratio-combinatorics
    type: (permutation) -> number
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
