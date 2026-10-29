---
name: CrossingNumber
domain: Set partition statistics
signature: CrossingNumber(partition)
summary: The largest number of arcs that mutually cross.
catalog:
  - system: findstat
    identity: St000253
    url: https://www.findstat.org/St000253
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: CrossingNumber(partition)
    description: The largest number of arcs that mutually cross.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St000253. A set of arcs mutually crosses when all start before any ends; the longest such chain is found at each point between starts and ends.
