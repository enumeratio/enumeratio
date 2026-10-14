---
name: CellsOutsideLargestStaircase
domain: Partition statistics
signature: CellsOutsideLargestStaircase(partition)
summary: Cells of the diagram outside the largest staircase it contains.
catalog:
  - system: findstat
    identity: St001384
    url: https://www.findstat.org/St001384
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: CellsOutsideLargestStaircase(partition)
    description: Cells of the diagram outside the largest staircase it contains.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
