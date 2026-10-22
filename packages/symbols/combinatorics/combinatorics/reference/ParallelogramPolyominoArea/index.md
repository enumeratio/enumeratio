---
name: ParallelogramPolyominoArea
domain: Dyck path statistics
signature: ParallelogramPolyominoArea(path)
summary: The cells of the parallelogram polyomino the path corresponds to under the Delest-Viennot bijection.
catalog:
  - system: findstat
    identity: St001034
    url: https://www.findstat.org/St001034
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: ParallelogramPolyominoArea(path)
    description: The cells of the parallelogram polyomino the path corresponds to under the Delest-Viennot bijection.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
