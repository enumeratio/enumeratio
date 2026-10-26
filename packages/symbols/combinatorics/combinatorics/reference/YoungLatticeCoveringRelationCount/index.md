---
name: YoungLatticeCoveringRelationCount
domain: Partition statistics
signature: YoungLatticeCoveringRelationCount(partition)
summary: "The covering relations of Young's lattice among the partitions contained in this one: the sum of their corners."
catalog:
  - system: findstat
    identity: St001360
    url: https://www.findstat.org/St001360
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: YoungLatticeCoveringRelationCount(partition)
    description: "The covering relations of Young's lattice among the partitions contained in this one: the corners, summed over those partitions. The table carries, for each last row size, the number of choices and the corners they have so far."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
