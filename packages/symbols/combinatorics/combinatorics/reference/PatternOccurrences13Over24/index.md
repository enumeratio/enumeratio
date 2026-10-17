---
name: PatternOccurrences13Over24
domain: Set partition statistics
signature: PatternOccurrences13Over24(partition)
summary: "Occurrences of the pattern 13/24: a < b < c < d with a, c in one block and b, d in another."
catalog:
  - system: findstat
    identity: St000559
    url: https://www.findstat.org/St000559
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: PatternOccurrences13Over24(partition)
    description: "Occurrences of the pattern 13/24: a < b < c < d with a, c in one block and b, d in another."
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
