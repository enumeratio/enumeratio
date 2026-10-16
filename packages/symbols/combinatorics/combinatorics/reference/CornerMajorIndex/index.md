---
name: CornerMajorIndex
domain: Partition statistics
signature: CornerMajorIndex(partition)
summary: "The sum, over the corners, of the step number along the boundary path from the bottom left: (number of parts - i) + the i-th part."
catalog:
  - system: findstat
    identity: St000770
    url: https://www.findstat.org/St000770
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: CornerMajorIndex(partition)
    description: The sum of the positions of the corners, counted from the bottom row.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- For (8, 6, 6, 4, 3, 3) the corners are at steps 3, 6, 9 and 13, so the value is 31 (FindStat's St000770 example).
