---
name: ParallelogramPolyominoNormalizedArea
domain: Dyck path statistics
signature: ParallelogramPolyominoNormalizedArea(path)
summary: "The area of the parallelogram polyomino less the semilength: the cells beyond the smallest polyomino."
catalog:
  - system: findstat
    identity: St001033
    url: https://www.findstat.org/St001033
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: ParallelogramPolyominoNormalizedArea(path)
    description: "The area of the parallelogram polyomino less the semilength: the cells beyond the smallest polyomino."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
