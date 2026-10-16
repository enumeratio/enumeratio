---
name: PeakRectangleAreaSum
domain: Dyck path statistics
signature: PeakRectangleAreaSum(path)
summary: The sum, over consecutive peaks, of the area of the rectangle they span with the valley between them.
catalog:
  - system: findstat
    identity: St000645
    url: https://www.findstat.org/St000645
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: PeakRectangleAreaSum(path)
    description: The sum, over consecutive peaks, of the area of the rectangle they span with the valley between them.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Positions are counted from 1; only differences enter.
