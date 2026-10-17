---
name: MahonianInversions
domain: Set partition statistics
signature: MahonianInversions(partition)
summary: Inversions of the Mahonian word.
catalog:
  - system: findstat
    identity: St001841
    url: https://www.findstat.org/St001841
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: MahonianInversions(partition)
    description: Inversions of the Mahonian word.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
