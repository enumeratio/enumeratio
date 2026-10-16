---
name: IsLoopFreeGraph
domain: Collections
signature: IsLoopFreeGraph(g)
summary: Whether a [[Graph]] has no self-loop.
signatures:
  - call: IsLoopFreeGraph(g)
    description: true iff no edge of g joins a vertex to itself.
    library: enumeratio-combinatorics
    type: (value) -> boolean
seeAlso:
  - IsSimpleGraph
names:
  wolfram: LoopFreeGraphQ
bindings:
  - origin: mapped
    form: sage
    template: (not ($1).has_loops())
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Wolfram calls this `LoopFreeGraphQ`; this library uses the `Is…` spelling everywhere.
