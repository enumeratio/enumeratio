---
name: PatternOccurrences1Over23
domain: Set partition statistics
signature: PatternOccurrences1Over23(partition)
summary: "Occurrences of the pattern 1/23: b < c in one block and a < b in another."
catalog:
  - system: findstat
    identity: St000556
    url: https://www.findstat.org/St000556
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: PatternOccurrences1Over23(partition)
    description: "Occurrences of the pattern 1/23: b < c in one block and a < b in another."
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
