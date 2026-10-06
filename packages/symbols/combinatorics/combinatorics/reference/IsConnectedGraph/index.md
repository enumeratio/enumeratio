---
name: IsConnectedGraph
domain: Collections
signature: IsConnectedGraph(g)
summary: Whether a [[Graph]] is connected — a single component; strongly connected when it has directed edges.
signatures:
  - call: IsConnectedGraph(g)
    description: true iff the graph is one component, respecting edge direction (false for a graph with no vertices).
    library: enumeratio-combinatorics
    type: (value) -> boolean
seeAlso:
  - ConnectedComponents
  - IsTreeGraph
names:
  wolfram: ConnectedGraphQ
---

- Wolfram calls this `ConnectedGraphQ`; this library uses the `Is…` spelling everywhere.
- Respects direction, as Wolfram's `ConnectedGraphQ` does: a directed graph is connected only when it is strongly connected, so a single directed edge is not. [[IsTreeGraph]] still reads the underlying undirected graph.
