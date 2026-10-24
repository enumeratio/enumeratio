---
name: MinimalSubpartitionSizeDifference
domain: Partition statistics
signature: MinimalSubpartitionSizeDifference(partition)
summary: The smallest difference in size between the two halves of a split of the parts into two sub-multisets.
signatures:
  - call: MinimalSubpartitionSizeDifference(partition)
    description: The smallest difference in size between the two halves of a split of the parts into two sub-multisets.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St000835
    url: https://www.findstat.org/St000835
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
