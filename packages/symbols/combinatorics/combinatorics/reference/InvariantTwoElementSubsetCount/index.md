---
name: InvariantTwoElementSubsetCount
domain: Partition statistics
signature: InvariantTwoElementSubsetCount(partition)
summary: "Invariant 2-element subsets: a pair of fixed points or a 2-cycle."
signatures:
  - call: InvariantTwoElementSubsetCount(partition)
    description: "Invariant 2-element subsets: a pair of fixed points or a 2-cycle."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St000513
    url: https://www.findstat.org/St000513
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
