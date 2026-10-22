---
name: SetPartitionsWithBlockSizesCount
domain: Partition statistics
signature: SetPartitionsWithBlockSizesCount(partition)
summary: "The number of set partitions whose block sizes are the parts: the size factorial over the product of the factorials of the parts and of the multiplicities."
signatures:
  - call: SetPartitionsWithBlockSizesCount(partition)
    description: "The number of set partitions whose block sizes are the parts: the size factorial over the product of the factorials of the parts and of the multiplicities."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
