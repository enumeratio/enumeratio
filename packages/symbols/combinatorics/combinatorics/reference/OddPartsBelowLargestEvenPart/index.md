---
name: OddPartsBelowLargestEvenPart
domain: Partition statistics
signature: OddPartsBelowLargestEvenPart(partition)
summary: Odd parts smaller than the largest even part.
catalog:
  - system: findstat
    identity: St001586
    url: https://www.findstat.org/St001586
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: OddPartsBelowLargestEvenPart(partition)
    description: Odd parts smaller than the largest even part.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
