---
name: OccurrencesOf1Over23Openers12
domain: Set partition statistics
signature: OccurrencesOf1Over23Openers12(partition)
summary: Occurrences of the pattern 1/23 with 1 and 2 the least elements of their blocks.
signatures:
  - call: OccurrencesOf1Over23Openers12(partition)
    description: Occurrences of the pattern 1/23 with 1 and 2 the least elements of their blocks.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
catalog:
  - system: findstat
    identity: St000609
    url: https://www.findstat.org/St000609
    on: SetPartition
statOn:
  - SetPartition
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
