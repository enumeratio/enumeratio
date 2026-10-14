---
name: HookLengthOfFirstCell
domain: Partition statistics
signature: HookLengthOfFirstCell(partition)
summary: "The hook length of cell (1,1): the largest part plus the number of parts, less one."
catalog:
  - system: findstat
    identity: St000459
    url: https://www.findstat.org/St000459
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: HookLengthOfFirstCell(partition)
    description: "The hook length of cell (1,1): the largest part plus the number of parts, less one."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
