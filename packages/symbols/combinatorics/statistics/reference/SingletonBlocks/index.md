---
name: SingletonBlocks
domain: Set partition statistics
signature: SingletonBlocks(partition)
summary: Blocks containing exactly one element.
catalog:
  - system: findstat
    identity: St000247
    url: https://www.findstat.org/St000247
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: SingletonBlocks(partition)
    description: Blocks containing exactly one element.
    library: enumeratio-statistics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
