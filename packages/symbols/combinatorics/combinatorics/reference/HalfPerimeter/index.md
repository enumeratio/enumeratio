---
name: HalfPerimeter
domain: Partition statistics
signature: HalfPerimeter(partition)
summary: "Half the perimeter of the bounding rectangle of the Young diagram: largest part plus number of parts."
signatures:
  - call: HalfPerimeter(partition)
    description: "Half the perimeter of the bounding rectangle of the Young diagram: largest part plus number of parts."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St000459 calls the hook length of the base cell the perimeter; that is `HookLengthOfFirstCell`, one less than this.
