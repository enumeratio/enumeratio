---
name: IsAcyclicGraph
domain: Collections
signature: IsAcyclicGraph(g)
summary: Whether a [[Graph]] contains no cycle.
signatures:
  - call: IsAcyclicGraph(g)
    description: true iff g has no cycle, respecting edge direction where g has directed edges.
    library: enumeratio-combinatorics
    type: (value) -> boolean
seeAlso:
  - IsTreeGraph
  - IsPathGraph
names:
  wolfram: AcyclicGraphQ
bindings:
  - origin: mapped
    form: sage
    template: "(lambda g: g.is_directed_acyclic() if g.is_directed() else g.is_forest())($1)"
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Wolfram calls this `AcyclicGraphQ`; this library uses the `Is…` spelling everywhere.
- A self-loop, and two vertices joined by directed edges in BOTH directions, both count as cycles. An undirected edge alone never does -- walking straight back over the SAME edge you just arrived by isn't a cycle, so a plain undirected tree reads acyclic (matches [[IsTreeGraph]]'s own edges = vertices - 1 check).
