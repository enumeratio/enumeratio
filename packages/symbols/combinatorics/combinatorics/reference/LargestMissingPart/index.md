---
name: LargestMissingPart
domain: Partition statistics
signature: LargestMissingPart(partition)
summary: The largest integer below the largest part that is not a part; 0 if every smaller integer is.
catalog:
  - system: findstat
    identity: St001392
    url: https://www.findstat.org/St001392
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: LargestMissingPart(partition)
    description: The largest integer below the largest part that is not a part; 0 if every smaller integer is.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- 0 counts as a candidate, so the value is 0 when every smaller positive integer is a part.
