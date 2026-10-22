---
name: HalfLargestEvenPart
domain: Partition statistics
signature: HalfLargestEvenPart(partition)
summary: Half the largest even part; 0 if there is none.
signatures:
  - call: HalfLargestEvenPart(partition)
    description: Half the largest even part; 0 if there is none.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
