---
name: VertexDegree
domain: Collections
signature: VertexDegree(g, v)
summary: How many edge-ends meet a vertex — direction-blind (a self-loop counts twice).
signatures:
  - call: VertexDegree(g)
    description: the degree of every vertex of $g$, as a list in [[VertexList]] order.
    library: enumeratio-collections
    type: (value, any?) -> value
  - call: VertexDegree(g, v)
    description: the degree of $v$ alone.
    library: enumeratio-collections
    arity: 2
seeAlso:
  - AdjacencyMatrix
  - Graph
names:
  wolframIdentity: true
---

- Total degree, in and out combined — a directed edge counts once at each endpoint, same as an undirected one. Sums to $2|E|$ (the handshake lemma), which the tests check against an independently-computed sum on random graphs.
