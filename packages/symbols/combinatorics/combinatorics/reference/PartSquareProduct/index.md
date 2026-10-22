---
name: PartSquareProduct
domain: Partition statistics
signature: PartSquareProduct(partition)
summary: The product of the squares of the parts.
signatures:
  - call: PartSquareProduct(partition)
    description: The product of the squares of the parts.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
