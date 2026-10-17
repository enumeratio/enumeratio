---
name: ZIndex
domain: Set partition statistics
signature: ZIndex(partition)
summary: The major indices of the Mahonian word restricted to each pair of letters, summed.
catalog:
  - system: findstat
    identity: St001843
    url: https://www.findstat.org/St001843
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: ZIndex(partition)
    description: The major indices of the Mahonian word restricted to each pair of letters, summed.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
