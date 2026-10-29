---
name: TopologicallyConnectedComponents
domain: Set partition statistics
signature: TopologicallyConnectedComponents(partition)
summary: "The topologically connected components of the arc diagram: blocks joined when an arc of one crosses an arc of the other."
catalog:
  - system: findstat
    identity: St000925
    url: https://www.findstat.org/St000925
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: TopologicallyConnectedComponents(partition)
    description: "The topologically connected components of the arc diagram: blocks joined when an arc of one crosses an arc of the other."
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St000925. A singleton, which has no arc, is a component of its own.
