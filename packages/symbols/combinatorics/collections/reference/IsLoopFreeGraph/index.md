---
name: IsLoopFreeGraph
domain: Collections
signature: IsLoopFreeGraph(g)
summary: Whether a [[Graph]] has no self-loop.
signatures:
  - call: IsLoopFreeGraph(g)
    description: true iff no edge of g joins a vertex to itself.
    library: enumeratio-collections
    type: (value) -> boolean
seeAlso:
  - IsSimpleGraph
names:
  wolfram: LoopFreeGraphQ
---

- Wolfram calls this `LoopFreeGraphQ`; this library uses the `Is…` spelling everywhere.
