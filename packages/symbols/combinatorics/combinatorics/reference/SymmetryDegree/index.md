---
name: SymmetryDegree
domain: Dyck path statistics
signature: SymmetryDegree(path)
summary: The number of step pairs, counting inward from the ends, at which the path agrees in height with its mirror image.
catalog:
  - system: findstat
    identity: St001523
    url: https://www.findstat.org/St001523
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: SymmetryDegree(path)
    description: The number of step pairs, counting inward from the ends, at which the path agrees in height with its mirror image.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
