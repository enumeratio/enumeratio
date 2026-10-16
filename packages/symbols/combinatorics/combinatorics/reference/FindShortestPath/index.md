---
name: FindShortestPath
domain: Collections
signature: FindShortestPath(g, u, v)
summary: A shortest path from u to v, respecting edge direction (BFS, unweighted).
signatures:
  - call: FindShortestPath(g, u, v)
    description: the vertices of one shortest $u \to v$ path, both ends included; the empty list if $v$ is unreachable from $u$.
    library: enumeratio-combinatorics
    type: (value, any, any) -> list<any>
seeAlso:
  - GraphDistance
  - GraphDistanceMatrix
  - Graph
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: ($1).shortest_path($2, $3)
    arity: 3
    checked:
      version: "10.9"
      on: 2026-10-16
---

- A directed edge is only traversable forward; an undirected edge, either way.
- Weighted (g carries EdgeWeight): the path minimizing summed edge weight (Dijkstra), not the fewest hops — same as Wolfram, which reads EdgeWeight automatically when present. Requires every weight to be non-negative; a negative weight leaves the call unevaluated rather than guess (Dijkstra doesn't support them — Wolfram itself switches algorithm in that case, out of scope here).
