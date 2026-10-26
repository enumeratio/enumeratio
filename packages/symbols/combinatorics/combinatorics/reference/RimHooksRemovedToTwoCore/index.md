---
name: RimHooksRemovedToTwoCore
domain: Partition statistics
signature: RimHooksRemovedToTwoCore(partition)
summary: "The 2-rim hooks removed to reach the 2-core: the size less the core's, over 2, the core read off the abacus."
catalog:
  - system: findstat
    identity: St000698
    url: https://www.findstat.org/St000698
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: RimHooksRemovedToTwoCore(partition)
    description: "The number of 2-rim hooks removed to reach the 2-core: the size less the core's, over 2. The core's size is read off the abacus, from how many beads sit on each runner."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
