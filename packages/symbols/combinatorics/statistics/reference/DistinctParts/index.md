---
name: DistinctParts
domain: Partition statistics
signature: DistinctParts(partition)
summary: How many distinct part sizes occur.
references:
  - system: wikipedia
    identity: Integer partition
  - system: oeis
    identity: A000009
catalog:
  - system: findstat
    identity: St000159
    url: https://www.findstat.org/St000159
    on: IntegerPartition
statOn:
  - CorePartition
  - IntegerPartition
signatures:
  - call: DistinctParts(partition)
    description: How many distinct part sizes occur.
    library: enumeratio-statistics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
