---
name: InitialRise
domain: Dyck path statistics
signature: InitialRise(path)
summary: The length of the opening run of up steps.
statOn:
  - DyckPath
signatures:
  - call: InitialRise(path)
    description: The length of the opening run of up steps.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Height equals the index exactly while every step so far has been an up step.
