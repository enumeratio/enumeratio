---
name: WeaklyAboveLatticePathCount
domain: Dyck path statistics
signature: WeaklyAboveLatticePathCount(path)
summary: The up-and-down paths of the same length, ending anywhere, that stay weakly above this path.
catalog:
  - system: findstat
    identity: St001361
    url: https://www.findstat.org/St001361
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: WeaklyAboveLatticePathCount(path)
    description: The up-and-down paths of the same length, ending anywhere, that stay weakly above this path.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The paths need not return to the axis: `2^n` for the highest path, the central binomial coefficient for the zigzag.
