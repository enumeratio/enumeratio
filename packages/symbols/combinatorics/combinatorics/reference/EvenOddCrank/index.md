---
name: EvenOddCrank
domain: Partition statistics
signature: EvenOddCrank(partition)
summary: The largest even part minus the number of odd parts.
catalog:
  - system: findstat
    identity: St000997
    url: https://www.findstat.org/St000997
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: EvenOddCrank(partition)
    description: The largest even part minus the number of odd parts.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Not the Andrews-Garvan `Crank`: this is the largest even part minus the number of odd parts.
