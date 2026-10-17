---
name: MahonianWordDescents
domain: Set partition statistics
signature: MahonianWordDescents(partition)
summary: Descents of the Mahonian word.
catalog:
  - system: findstat
    identity: St001840
    url: https://www.findstat.org/St001840
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: MahonianWordDescents(partition)
    description: Descents of the Mahonian word.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
