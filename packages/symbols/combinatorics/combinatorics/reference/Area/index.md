---
name: Area
domain: Dyck path statistics
signature: Area(path)
summary: "The area between the path and the axis: the total of the heights after each step."
statOn:
  - DelannoyPath
  - DyckPath
  - MotzkinPath
  - PythagoreanTriple
signatures:
  - call: Area(path)
    description: "The area between the path and the axis: the total of the heights after each step."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
