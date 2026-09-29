---
name: LargestPart
domain: Partition statistics
signature: LargestPart(partition)
summary: The largest part.
catalog:
  - system: findstat
    identity: St001447
    url: https://www.findstat.org/St001447
    on: PlanePartition
statOn:
  - Composition
  - CorePartition
  - IntegerPartition
  - PlanePartition
  - WeakComposition
signatures:
  - call: LargestPart(partition)
    description: The largest part.
    library: enumeratio-statistics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
