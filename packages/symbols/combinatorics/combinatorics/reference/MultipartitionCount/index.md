---
name: MultipartitionCount
domain: Partition statistics
signature: MultipartitionCount(partition)
summary: "Tuples of partitions whose sizes are the parts: the product of the partition numbers of the parts."
catalog:
  - system: findstat
    identity: St000933
    url: https://www.findstat.org/St000933
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: MultipartitionCount(partition)
    description: "The number of tuples of partitions whose sizes are the parts: the product of the partition numbers of the parts."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
