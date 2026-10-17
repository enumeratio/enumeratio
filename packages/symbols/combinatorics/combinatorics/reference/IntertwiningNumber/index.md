---
name: IntertwiningNumber
domain: Set partition statistics
signature: IntertwiningNumber(partition)
summary: Pairs a < b in different blocks with no element of either block between them.
catalog:
  - system: findstat
    identity: St000490
    url: https://www.findstat.org/St000490
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: IntertwiningNumber(partition)
    description: Pairs a < b in different blocks with no element of either block between them.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The block intertwiners of Huang and Rhoades, counted over all pairs of blocks.
