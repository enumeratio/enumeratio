---
name: SeaweedAlgebraDimension
domain: Partition statistics
signature: SeaweedAlgebraDimension(partition)
summary: "The dimension of the maximal parabolic seaweed algebra: half the sum of the squares of the parts and of the size."
catalog:
  - system: findstat
    identity: St001262
    url: https://www.findstat.org/St001262
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SeaweedAlgebraDimension(partition)
    description: "The dimension of the maximal parabolic seaweed algebra: half the sum of the squares of the parts and of the size."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
