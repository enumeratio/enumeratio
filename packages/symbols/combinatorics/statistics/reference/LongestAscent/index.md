---
name: LongestAscent
domain: Dyck path statistics
signature: LongestAscent(path)
summary: The longest run of consecutive up steps.
statOn:
  - DyckPath
signatures:
  - call: LongestAscent(path)
    description: The longest run of consecutive up steps.
    library: enumeratio-statistics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
