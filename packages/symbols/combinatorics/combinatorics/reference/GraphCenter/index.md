---
name: GraphCenter
domain: Collections
signature: GraphCenter(g)
summary: The vertices of a [[Graph]] whose eccentricity equals GraphRadius(g).
signatures:
  - call: GraphCenter(g)
    description: every vertex with the smallest (finite) eccentricity, in VertexList(g) order.
    library: enumeratio-combinatorics
    type: (value) -> list<any>
seeAlso:
  - GraphPeriphery
  - GraphRadius
  - VertexEccentricity
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: ($1).center()
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- A vertex with an infinite eccentricity (unreachable from some other vertex) is never in the center, even on a disconnected graph where every FINITE eccentricity happens to tie.
