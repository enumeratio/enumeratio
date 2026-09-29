---
name: Coarea
domain: Dyck path statistics
signature: Coarea(path)
summary: The complement of the area within the enclosing triangle.
statOn:
  - DyckPath
signatures:
  - call: Coarea(path)
    description: The complement of the area within the enclosing triangle.
    library: enumeratio-statistics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Defined against the n(n+1)/2 triangle for a path of 2n steps.
