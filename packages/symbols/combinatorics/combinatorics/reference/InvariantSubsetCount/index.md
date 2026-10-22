---
name: InvariantSubsetCount
domain: Partition statistics
signature: InvariantSubsetCount(partition)
summary: "Subsets of the points left invariant by a permutation with these cycle lengths: each cycle is in or out, 2 to the number of cycles."
signatures:
  - call: InvariantSubsetCount(partition)
    description: "Subsets of the points left invariant by a permutation with these cycle lengths: each cycle is in or out, 2 to the number of cycles."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
