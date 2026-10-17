---
name: DistinctBlockPairsSingletonThenMaximal
domain: Set partition statistics
signature: DistinctBlockPairsSingletonThenMaximal(partition)
summary: Pairs a < b in different blocks with a a singleton block and b the greatest element of its block.
catalog:
  - system: findstat
    identity: St000573
    url: https://www.findstat.org/St000573
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: DistinctBlockPairsSingletonThenMaximal(partition)
    description: Pairs a < b in different blocks with a a singleton block and b the greatest element of its block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
