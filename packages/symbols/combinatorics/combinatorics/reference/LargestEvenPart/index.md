---
name: LargestEvenPart
domain: Partition statistics
signature: LargestEvenPart(partition)
summary: The largest even part; 0 if there is none.
catalog:
  - system: findstat
    identity: St000995
    url: https://www.findstat.org/St000995
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: LargestEvenPart(partition)
    description: The largest even part; 0 if there is none.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
