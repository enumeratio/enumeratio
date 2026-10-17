---
name: FlattenedMajorIndexVariant
domain: Set partition statistics
signature: FlattenedMajorIndexVariant(partition)
summary: The major index of the flattened permutation, plus for each block ending before the next begins the elements so far beyond each block's first.
catalog:
  - system: findstat
    identity: St000747
    url: https://www.findstat.org/St000747
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: FlattenedMajorIndexVariant(partition)
    description: The major index of the flattened permutation, plus for each block ending before the next begins the elements so far beyond each block's first.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Ehrenborg and Readdy's variant.
