---
name: OccurrencesOf12Over3
domain: Set partition statistics
signature: OccurrencesOf12Over3(partition)
summary: "Occurrences of the pattern 12/3: a < b in one block and c > b in another."
catalog:
  - system: findstat
    identity: St000554
    url: https://www.findstat.org/St000554
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: OccurrencesOf12Over3(partition)
    description: "Occurrences of the pattern 12/3: a < b in one block and c > b in another."
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
