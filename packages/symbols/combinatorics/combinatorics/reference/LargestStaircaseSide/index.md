---
name: LargestStaircaseSide
domain: Partition statistics
signature: LargestStaircaseSide(partition)
summary: The side of the largest staircase (k, k-1, ..., 1) inside the diagram.
catalog:
  - system: findstat
    identity: St000783
    url: https://www.findstat.org/St000783
    on: IntegerPartition
  - system: findstat
    identity: St001432
    url: https://www.findstat.org/St001432
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: LargestStaircaseSide(partition)
    description: The side of the largest staircase (k, k-1, ..., 1) inside the diagram.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
