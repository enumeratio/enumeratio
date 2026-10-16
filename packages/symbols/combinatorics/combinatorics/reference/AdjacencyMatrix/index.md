---
name: AdjacencyMatrix
domain: Collections
signature: AdjacencyMatrix(g)
summary: The vertex-by-vertex adjacency matrix of a [[Graph]], indexed by [[VertexList]] order.
signatures:
  - call: AdjacencyMatrix(g)
    description: entry $(i, j)$ is the number of edges from vertex $i$ to vertex $j$ — 0 or 1 for a simple graph, symmetric when every edge is undirected.
    library: enumeratio-combinatorics
    type: (value) -> list<list<integer>>
seeAlso:
  - IncidenceMatrix
  - VertexDegree
  - WeightedAdjacencyMatrix
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: "[list(r) for r in ($1).adjacency_matrix().rows()]"
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Returned as a plain matrix (a list of lists) rather than Wolfram's default `SparseArray` — a deliberate simplification here, since this library has no sparse-matrix head to return instead.
