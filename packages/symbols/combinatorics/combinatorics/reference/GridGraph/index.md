---
name: GridGraph
domain: Collections
signature: GridGraph(dims)
summary: A rectangular (or higher-dimensional) grid graph.
signatures:
  - call: GridGraph(dims)
    description: the Cartesian product of paths of the given lengths — `GridGraph({m, n})` is an $m \times n$ grid. Vertices are numbered 1-based, the first index varying fastest, as in Wolfram.
    library: enumeratio-combinatorics
    type: (list<integer>) -> value
seeAlso:
  - HypercubeGraph
  - CompleteGraph
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_graph(graphs.GridGraph($1))
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
