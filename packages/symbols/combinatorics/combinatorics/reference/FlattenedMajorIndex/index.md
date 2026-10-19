---
name: FlattenedMajorIndex
domain: Set partition statistics
signature: FlattenedMajorIndex(partition)
summary: The major index of the permutation listing the blocks in order, each ascending.
catalog:
  - system: findstat
    identity: St000748
    url: https://www.findstat.org/St000748
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: FlattenedMajorIndex(partition)
    description: The major index of the permutation listing the blocks in order, each ascending.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
