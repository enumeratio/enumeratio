---
name: CycleGraph
domain: Collections
signature: CycleGraph(n)
summary: The cycle graph $C_n$ — $n$ vertices joined in a ring.
signatures:
  - call: CycleGraph(n)
    description: $C_n$ ($n \geq 3$), vertices $1, \dots, n$, each joined to its neighbours around the ring.
    library: enumeratio-combinatorics
    type: (integer) -> value
seeAlso:
  - PathGraph
  - IsBipartiteGraph
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_graph(graphs.CycleGraph($1))
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
