---
name: CellsOutsideFirstHook
domain: Partition statistics
signature: CellsOutsideFirstHook(partition)
summary: "Cells in neither the first row nor the first column: the size minus the hook length of cell (1,1)."
catalog:
  - system: findstat
    identity: St001175
    url: https://www.findstat.org/St001175
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: CellsOutsideFirstHook(partition)
    description: "Cells in neither the first row nor the first column: the size minus the hook length of cell (1,1)."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
