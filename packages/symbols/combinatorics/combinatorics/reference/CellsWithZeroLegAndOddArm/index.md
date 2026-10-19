---
name: CellsWithZeroLegAndOddArm
domain: Partition statistics
signature: CellsWithZeroLegAndOddArm(partition)
summary: Cells with leg 0 and an odd arm.
catalog:
  - system: findstat
    identity: St000149
    url: https://www.findstat.org/St000149
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: CellsWithZeroLegAndOddArm(partition)
    description: Cells with leg 0 and an odd arm.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
