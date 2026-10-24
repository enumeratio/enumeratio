---
name: InterlacingPartitionCount
domain: Partition statistics
signature: InterlacingPartitionCount(partition)
summary: "The number of partitions that interlace this one: the product over the parts of the gap to the next part (0 after the last) plus 1."
signatures:
  - call: InterlacingPartitionCount(partition)
    description: "The number of partitions that interlace this one: the product over the parts of the gap to the next part (0 after the last) plus 1."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St001814
    url: https://www.findstat.org/St001814
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
