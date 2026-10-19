---
name: InterlacingNumber
domain: Set partition statistics
signature: InterlacingNumber(partition)
summary: Pairs of blocks whose i-th arcs interlace, each block closed by an arc to infinity.
catalog:
  - system: findstat
    identity: St001781
    url: https://www.findstat.org/St001781
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: InterlacingNumber(partition)
    description: Pairs of blocks whose i-th arcs interlace, each block closed by an arc to infinity.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
