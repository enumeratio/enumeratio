---
name: LargestShiftedPart
domain: Partition statistics
signature: LargestShiftedPart(partition)
summary: The largest part after adding i - 1 to the i-th part.
catalog:
  - system: findstat
    identity: St000384
    url: https://www.findstat.org/St000384
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: LargestShiftedPart(partition)
    description: The largest part after adding i - 1 to the i-th part.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- One less than `MaximalRectangleHalfPerimeter`, except that both are 0 on the empty partition.
