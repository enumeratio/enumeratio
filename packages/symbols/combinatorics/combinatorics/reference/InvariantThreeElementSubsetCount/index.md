---
name: InvariantThreeElementSubsetCount
domain: Partition statistics
signature: InvariantThreeElementSubsetCount(partition)
summary: "Invariant 3-element subsets: three fixed points, a fixed point and a 2-cycle, or a 3-cycle."
signatures:
  - call: InvariantThreeElementSubsetCount(partition)
    description: "Invariant 3-element subsets: three fixed points, a fixed point and a 2-cycle, or a 3-cycle."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
