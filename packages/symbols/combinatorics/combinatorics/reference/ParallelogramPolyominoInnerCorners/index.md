---
name: ParallelogramPolyominoInnerCorners
domain: Dyck path statistics
signature: ParallelogramPolyominoInnerCorners(path)
summary: "The inner corners of the parallelogram polyomino: the turns from east to north on its two bounding paths, not counting the corners every polyomino has."
catalog:
  - system: findstat
    identity: St001036
    url: https://www.findstat.org/St001036
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: ParallelogramPolyominoInnerCorners(path)
    description: "The inner corners of the parallelogram polyomino: the turns from east to north on its two bounding paths, not counting the corners every polyomino has."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
