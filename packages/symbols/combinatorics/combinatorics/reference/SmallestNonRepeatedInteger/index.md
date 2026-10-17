---
name: SmallestNonRepeatedInteger
domain: Partition statistics
signature: SmallestNonRepeatedInteger(partition)
summary: The smallest positive integer that is not a part at least twice.
catalog:
  - system: findstat
    identity: St001568
    url: https://www.findstat.org/St001568
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SmallestNonRepeatedInteger(partition)
    description: The smallest positive integer that is not a part at least twice.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The integer need not be a part: it is the least k >= 1 with fewer than two parts equal to k.
