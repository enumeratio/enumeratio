---
name: PartsEqualToNextPart
domain: Partition statistics
signature: PartsEqualToNextPart(partition)
summary: "Parts whose next smaller part has the same size: the number of parts less the distinct parts."
catalog:
  - system: findstat
    identity: St001091
    url: https://www.findstat.org/St001091
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: PartsEqualToNextPart(partition)
    description: "Parts whose next smaller part has the same size: the number of parts less the distinct parts."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
