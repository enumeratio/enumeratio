---
name: LargestRepeatedPart
domain: Partition statistics
signature: LargestRepeatedPart(partition)
summary: The largest part that occurs at least twice; 0 if the parts are distinct.
catalog:
  - system: findstat
    identity: St000143
    url: https://www.findstat.org/St000143
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: LargestRepeatedPart(partition)
    description: The largest part that occurs at least twice; 0 if the parts are distinct.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
