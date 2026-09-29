---
name: NeighborhoodGraph
domain: Collections
signature: NeighborhoodGraph(g, v, n)
summary: The induced subgraph on the vertices within distance n of v (underlying graph).
signatures:
  - call: NeighborhoodGraph(g, v)
    description: distance $\leq 1$ (v and its immediate neighbours).
    library: enumeratio-combinatorics
    type: (value, any, integer?) -> value
  - call: NeighborhoodGraph(g, v, n)
    description: distance $\leq n$, by BFS on the underlying (direction-blind) graph.
    library: enumeratio-combinatorics
    arity: 3
seeAlso:
  - Subgraph
  - GraphDistance
names:
  wolframIdentity: true
---
