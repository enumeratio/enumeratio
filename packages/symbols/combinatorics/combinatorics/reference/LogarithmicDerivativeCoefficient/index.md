---
name: LogarithmicDerivativeCoefficient
domain: Partition statistics
signature: LogarithmicDerivativeCoefficient(partition)
summary: "The coefficient of the monomial in the logarithmic derivative of 1 - c_1 x - c_2 x^2/2! - ..., times a factorial: the set partitions with these block sizes, times (length - 1)! for arranging the blocks in a cycle."
catalog:
  - system: findstat
    identity: St001968
    url: https://www.findstat.org/St001968
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: LogarithmicDerivativeCoefficient(partition)
    description: "The coefficient of the monomial in the logarithmic derivative of 1 - c_1 x - c_2 x^2/2! - ..., times the factorial: the multinomial of the parts times the rearrangements of the parts, over the number of parts."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
