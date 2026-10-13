---
name: ContainingSquareSide
domain: Partition statistics
signature: ContainingSquareSide(partition)
summary: "The side of the smallest square that contains the diagram: the larger of the largest part and the number of parts."
catalog:
  - system: findstat
    identity: St000784
    url: https://www.findstat.org/St000784
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: ContainingSquareSide(partition)
    description: "The side of the smallest square that contains the diagram: the larger of the largest part and the number of parts."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
