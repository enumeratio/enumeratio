---
name: ShiftedStandardTableauCount
domain: Partition statistics
signature: ShiftedStandardTableauCount(partition)
summary: "Standard tableaux of the shifted shape: the multinomial of the parts times, over pairs of parts, the difference over the sum. 0 when two parts are equal."
catalog:
  - system: findstat
    identity: St001593
    url: https://www.findstat.org/St001593
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: ShiftedStandardTableauCount(partition)
    description: "The number of standard tableaux of the shifted shape: the multinomial of the parts times the product over pairs of parts of (difference over sum). 0 when two parts are equal."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
