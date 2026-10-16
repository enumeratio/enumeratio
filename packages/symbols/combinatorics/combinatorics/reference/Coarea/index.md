---
name: Coarea
domain: Dyck path statistics
signature: Coarea(path)
summary: "The complement of the area within the staircase: binomial(n, 2) less the area."
statOn:
  - DyckPath
signatures:
  - call: Coarea(path)
    description: "The complement of the area within the staircase: binomial(n, 2) less the area."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Zero for the highest path, UU...DD, whose area is binomial(n, 2).
