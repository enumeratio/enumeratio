---
name: CompleteGraph
domain: Collections
signature: CompleteGraph(n)
summary: The complete graph $K_n$ — every pair of the $n$ vertices joined by an edge.
signatures:
  - call: CompleteGraph(n)
    description: $K_n$, with vertices $1, \dots, n$.
    library: enumeratio-combinatorics
    type: (integer) -> value
seeAlso:
  - PathGraph
  - CycleGraph
  - StarGraph
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_graph(graphs.CompleteGraph($1))
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
