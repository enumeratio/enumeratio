---
name: Nestings
domain: Set partition statistics
signature: Nestings(p)
summary: "SetPartition: pairs of arcs a < b < c < d with a~d and b~c. Permutation: pairs i, j with j < i < p(i) < p(j) or p(j) < p(i) <= i < j."
catalog:
  - system: findstat
    identity: St000041
    url: https://www.findstat.org/St000041
    on: PerfectMatching
  - system: findstat
    identity: St000233
    url: https://www.findstat.org/St000233
    on: SetPartition
  - system: findstat
    identity: St000223
    url: https://www.findstat.org/St000223
    on: Permutation
statOn:
  - PerfectMatching
  - Permutation
  - SetPartition
signatures:
  - call: Nestings(p)
    description: "SetPartition: pairs of arcs a < b < c < d with a~d and b~c. Permutation: pairs i, j with j < i < p(i) < p(j) or p(j) < p(i) <= i < j."
    library: enumeratio-combinatorics
    type: (permutation | set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- The complementary case to Crossings: one arc's span strictly contains the other's. Equidistributed with Crossings over set partitions of [n] (Kasraoui–Zeng), and the noncrossing and nonnesting partitions are each counted by the Catalan numbers.
- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Nestings of the arcs of the permutation diagram.
