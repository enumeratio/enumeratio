---
name: ElementarySymmetricFunctionAtOne
domain: Partition statistics
signature: ElementarySymmetricFunctionAtOne(partition)
summary: "The elementary symmetric function indexed by the partition, in as many variables as it has parts, all set to 1: the product of the binomial coefficients of the number of parts and each part."
signatures:
  - call: ElementarySymmetricFunctionAtOne(partition)
    description: "The elementary symmetric function indexed by the partition, in as many variables as it has parts, all set to 1: the product of the binomial coefficients of the number of parts and each part."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
