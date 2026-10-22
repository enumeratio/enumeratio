---
name: ParallelogramPolyominoMinimalColumnHeight
domain: Dyck path statistics
signature: ParallelogramPolyominoMinimalColumnHeight(path)
summary: The height of the shortest column of the parallelogram polyomino.
catalog:
  - system: findstat
    identity: St001038
    url: https://www.findstat.org/St001038
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: ParallelogramPolyominoMinimalColumnHeight(path)
    description: The height of the shortest column of the parallelogram polyomino.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
