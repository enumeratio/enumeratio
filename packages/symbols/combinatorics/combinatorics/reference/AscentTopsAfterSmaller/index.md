---
name: AscentTopsAfterSmaller
domain: Set partition statistics
signature: AscentTopsAfterSmaller(partition)
summary: Ascent tops of the flattened word with every smaller element earlier.
catalog:
  - system: findstat
    identity: St001641
    url: https://www.findstat.org/St001641
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: AscentTopsAfterSmaller(partition)
    description: Ascent tops of the flattened word with every smaller element earlier.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The binary logarithm of the number of set partitions with the same flattened word.
