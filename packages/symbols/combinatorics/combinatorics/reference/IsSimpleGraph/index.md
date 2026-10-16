---
name: IsSimpleGraph
domain: Collections
signature: IsSimpleGraph(g)
summary: Whether a [[Graph]] has no self-loop and no parallel (repeated) edge.
signatures:
  - call: IsSimpleGraph(g)
    description: true iff g has no self-loop and no two edges with the same endpoints and the same direction-ness.
    library: enumeratio-combinatorics
    type: (value) -> boolean
seeAlso:
  - IsLoopFreeGraph
  - IsCompleteGraph
names:
  wolfram: SimpleGraphQ
bindings:
  - origin: mapped
    form: sage
    template: (not ($1).has_loops() and not ($1).has_multiple_edges())
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Wolfram calls this `SimpleGraphQ`; this library uses the `Is…` spelling everywhere.
- A directed edge and its own reverse (a->b and b->a) are DIFFERENT edges, not a parallel pair -- both can be present in a simple directed graph. Two copies of the SAME undirected edge, or the same directed edge twice, are parallel.
