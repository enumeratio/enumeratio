---
name: MahonianWordMajorIndex
domain: Set partition statistics
signature: MahonianWordMajorIndex(partition)
summary: The major index of the Mahonian word.
catalog:
  - system: findstat
    identity: St001842
    url: https://www.findstat.org/St001842
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: MahonianWordMajorIndex(partition)
    description: The major index of the Mahonian word.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
