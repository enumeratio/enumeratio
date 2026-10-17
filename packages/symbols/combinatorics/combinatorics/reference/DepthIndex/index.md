---
name: DepthIndex
domain: Set partition statistics
signature: DepthIndex(partition)
summary: The sum of n - i over the arcs i, less the depth of each element, plus the depth of each arc.
catalog:
  - system: findstat
    identity: St001094
    url: https://www.findstat.org/St001094
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: DepthIndex(partition)
    description: The sum of n - i over the arcs i, less the depth of each element, plus the depth of each arc.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- An element's depth is the arcs strictly over it; an arc's, the arcs strictly over it.
