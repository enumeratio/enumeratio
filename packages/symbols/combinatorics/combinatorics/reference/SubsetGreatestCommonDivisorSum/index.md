---
name: SubsetGreatestCommonDivisorSum
domain: Partition statistics
signature: SubsetGreatestCommonDivisorSum(partition)
summary: "The sum, over the non-empty subsets of the parts, of their greatest common divisor: the sum over d of phi(d) times one less than 2 to the number of parts divisible by d."
signatures:
  - call: SubsetGreatestCommonDivisorSum(partition)
    description: "The sum, over the non-empty subsets of the parts, of their greatest common divisor: the sum over d of phi(d) times one less than 2 to the number of parts divisible by d."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St001985
    url: https://www.findstat.org/St001985
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
