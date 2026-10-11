---
name: DoubleRisePositionSum
domain: Dyck path statistics
signature: DoubleRisePositionSum(path)
summary: The sum of the positions where an up step is followed by an up step.
catalog:
  - system: findstat
    identity: St000976
    url: https://www.findstat.org/St000976
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: DoubleRisePositionSum(path)
    description: The sum of the positions where an up step is followed by an up step.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
