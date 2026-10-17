---
name: PatternOccurrences12Over34
domain: Set partition statistics
signature: PatternOccurrences12Over34(partition)
summary: "Occurrences of the pattern 12/34: a < b < c < d with a, b in one block and c, d in another."
catalog:
  - system: findstat
    identity: St000560
    url: https://www.findstat.org/St000560
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: PatternOccurrences12Over34(partition)
    description: "Occurrences of the pattern 12/34: a < b < c < d with a, b in one block and c, d in another."
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
