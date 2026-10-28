---
name: Crossings
domain: Set partition statistics
signature: Crossings(p)
summary: "SetPartition: pairs of arcs a < b < c < d with a~c and b~d. Permutation: pairs i, j with i < j <= p(i) < p(j) or p(i) < p(j) < i < j."
catalog:
  - system: findstat
    identity: St000042
    url: https://www.findstat.org/St000042
    on: PerfectMatching
  - system: findstat
    identity: St000232
    url: https://www.findstat.org/St000232
    on: SetPartition
  - system: findstat
    identity: St000039
    url: https://www.findstat.org/St000039
    on: Permutation
statOn:
  - PerfectMatching
  - Permutation
  - SetPartition
signatures:
  - call: Crossings(p)
    description: "SetPartition: pairs of arcs a < b < c < d with a~c and b~d. Permutation: pairs i, j with i < j <= p(i) < p(j) or p(i) < p(j) < i < j."
    library: enumeratio-combinatorics
    type: (permutation | set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Read off the standard arc representation: within each block, consecutive elements are linked, and a crossing is two arcs whose spans interleave rather than nest or sit apart.
- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Crossings of the arcs of the permutation diagram (Corteel).
