---
name: CellsWithEqualArmAndLeg
domain: Partition statistics
signature: CellsWithEqualArmAndLeg(partition)
summary: Cells whose arm and leg are equal.
catalog:
  - system: findstat
    identity: St001924
    url: https://www.findstat.org/St001924
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: CellsWithEqualArmAndLeg(partition)
    description: Cells whose arm and leg are equal.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
