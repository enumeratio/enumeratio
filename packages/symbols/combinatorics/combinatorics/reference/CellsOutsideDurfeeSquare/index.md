---
name: CellsOutsideDurfeeSquare
domain: Partition statistics
signature: CellsOutsideDurfeeSquare(partition)
summary: Cells of the diagram outside its Durfee square.
catalog:
  - system: findstat
    identity: St001382
    url: https://www.findstat.org/St001382
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: CellsOutsideDurfeeSquare(partition)
    description: Cells of the diagram outside its Durfee square.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
