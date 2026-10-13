---
name: FirstRowHookLengthSum
domain: Partition statistics
signature: FirstRowHookLengthSum(partition)
summary: "The sum of the hook lengths in the first row: the size plus the binomial of the largest part and 2."
catalog:
  - system: findstat
    identity: St000867
    url: https://www.findstat.org/St000867
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: FirstRowHookLengthSum(partition)
    description: "The sum of the hook lengths in the first row: the size plus the binomial of the largest part and 2."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
