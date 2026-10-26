---
name: LagrangeInversionCoefficient
domain: Partition statistics
signature: LagrangeInversionCoefficient(partition)
summary: "The coefficient of the monomial in the compositional-inverse series: n (n + 1) ... (n + length - 2) over the factorials of the multiplicities."
catalog:
  - system: findstat
    identity: St001967
    url: https://www.findstat.org/St001967
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: LagrangeInversionCoefficient(partition)
    description: "The coefficient of the monomial in the compositional-inverse series: the product of the size plus 0 to the number of parts less 2, over the product of the factorials of the multiplicities."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
