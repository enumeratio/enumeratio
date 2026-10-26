---
name: TransitiveMonotoneFactorizationCount
domain: Partition statistics
signature: TransitiveMonotoneFactorizationCount(partition)
summary: Transitive monotone factorizations of genus zero of a permutation of this cycle type, into n + length - 2 transpositions.
catalog:
  - system: findstat
    identity: St001938
    url: https://www.findstat.org/St001938
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: TransitiveMonotoneFactorizationCount(partition)
    description: "The transitive monotone factorizations of genus zero of a permutation of this cycle type, into n + length - 2 transpositions: the product of the central binomials and of the parts, times the rising factorial of 2n + 1 of length (length - 3), or its reciprocal."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
