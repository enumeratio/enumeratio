---
name: LengthCrank
domain: Partition statistics
signature: LengthCrank(partition)
summary: The number of parts when λ has no 1s, else (parts larger than the number of 1s) minus (the number of 1s).
catalog:
  - system: findstat
    identity: St000146
    url: https://www.findstat.org/St000146
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: LengthCrank(partition)
    description: The number of parts when λ has no 1s, else (parts larger than the number of 1s) minus (the number of 1s).
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Crank has the largest part where this has the number of parts; FindStat's St000146 follows the code, which takes the length.
