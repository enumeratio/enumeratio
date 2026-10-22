---
name: ParallelogramPolyominoUpperInnerCorners
domain: Dyck path statistics
signature: ParallelogramPolyominoUpperInnerCorners(path)
summary: "The inner corners of the polyomino's upper path: its turns from east to north, not counting the first."
catalog:
  - system: findstat
    identity: St001037
    url: https://www.findstat.org/St001037
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: ParallelogramPolyominoUpperInnerCorners(path)
    description: "The inner corners of the polyomino's upper path: its turns from east to north, not counting the first."
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The upper path of FindStat's polyomino is the one that opens with an east step here, up to reflecting the polyomino in the diagonal.
