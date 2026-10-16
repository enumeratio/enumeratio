---
name: MaximalRectangleHalfPerimeter
domain: Partition statistics
signature: MaximalRectangleHalfPerimeter(partition)
summary: Half the perimeter of the rectangle inside the diagram that has the greatest perimeter.
catalog:
  - system: findstat
    identity: St000380
    url: https://www.findstat.org/St000380
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: MaximalRectangleHalfPerimeter(partition)
    description: Half the perimeter of the rectangle inside the diagram that has the greatest perimeter.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
