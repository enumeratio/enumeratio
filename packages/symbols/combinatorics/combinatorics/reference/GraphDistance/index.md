---
name: GraphDistance
domain: Collections
signature: GraphDistance(g, u, v)
summary: The length of a shortest u to v path, respecting edge direction.
signatures:
  - call: GraphDistance(g, u, v)
    description: the number of edges on a shortest $u \to v$ path, or $+\infty$ if $v$ is unreachable from $u$.
    library: enumeratio-combinatorics
    type: (value, any, any) -> value
seeAlso:
  - FindShortestPath
  - GraphDistanceMatrix
  - WeightedAdjacencyMatrix
  - ConnectedComponents
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: ($1).distance($2, $3)
    arity: 3
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Weighted (g carries EdgeWeight -> {…}): the SUM of edge weights along the cheapest path (Dijkstra), not an edge count — read numerically, so an exact weight (a fraction, say) comes back as a float, not kept exact. Requires every weight non-negative; a negative one leaves the call unevaluated (see [[FindShortestPath]]'s own note).
