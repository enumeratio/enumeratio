---
name: Nestings
domain: Set partition statistics
signature: Nestings(partition)
summary: Pairs of arcs a < b < c < d with a~d and b~c.
catalog:
  - system: findstat
    identity: St000041
    url: https://www.findstat.org/St000041
    on: PerfectMatching
  - system: findstat
    identity: St000233
    url: https://www.findstat.org/St000233
    on: SetPartition
statOn:
  - PerfectMatching
  - SetPartition
signatures:
  - call: Nestings(partition)
    description: Pairs of arcs a < b < c < d with a~d and b~c.
    library: enumeratio-statistics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The complementary case to Crossings: one arc's span strictly contains the other's. Equidistributed with Crossings over set partitions of [n] (Kasraoui–Zeng), and the noncrossing and nonnesting partitions are each counted by the Catalan numbers.
