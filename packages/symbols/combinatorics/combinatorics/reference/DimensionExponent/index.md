---
name: DimensionExponent
domain: Set partition statistics
signature: DimensionExponent(partition)
summary: The sum over blocks of span minus (size - 1).
signatures:
  - call: DimensionExponent(partition)
    description: The sum over blocks of span minus (size - 1).
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
