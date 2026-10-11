---
name: InternalPoints
domain: Set partition statistics
signature: InternalPoints(partition)
summary: Elements with an earlier and a later element whose blocks open after theirs does.
signatures:
  - call: InternalPoints(partition)
    description: Elements with an earlier and a later element whose blocks open after theirs does.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- An element e is internal when some f < e < g have blocks with larger least element than e's block (Mansour, Section 5.5).
