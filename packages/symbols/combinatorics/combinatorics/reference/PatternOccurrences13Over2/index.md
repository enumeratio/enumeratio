---
name: PatternOccurrences13Over2
domain: Set partition statistics
signature: PatternOccurrences13Over2(partition)
summary: "Occurrences of the pattern 13/2: a < c in one block with b between them in another."
catalog:
  - system: findstat
    identity: St000555
    url: https://www.findstat.org/St000555
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: PatternOccurrences13Over2(partition)
    description: "Occurrences of the pattern 13/2: a < c in one block with b between them in another."
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
