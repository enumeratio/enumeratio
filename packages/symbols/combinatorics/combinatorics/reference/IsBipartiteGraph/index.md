---
name: IsBipartiteGraph
domain: Collections
signature: IsBipartiteGraph(g)
summary: Whether a [[Graph]]'s vertices split into two sets with every edge crossing between them.
signatures:
  - call: IsBipartiteGraph(g)
    description: true iff a 2-colouring exists (BFS, underlying graph, direction ignored) — false for any graph with an odd cycle, including a self-loop.
    library: enumeratio-combinatorics
    type: (value) -> boolean
seeAlso:
  - IsConnectedGraph
  - CycleGraph
names:
  wolfram: BipartiteGraphQ
bindings:
  - origin: mapped
    form: sage
    template: ($1).is_bipartite()
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Wolfram calls this `BipartiteGraphQ`; this library uses the `Is…` spelling everywhere.
