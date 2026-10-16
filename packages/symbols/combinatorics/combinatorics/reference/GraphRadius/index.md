---
name: GraphRadius
domain: Collections
signature: GraphRadius(g)
summary: The smallest eccentricity among all vertices of a [[Graph]].
signatures:
  - call: GraphRadius(g)
    description: min over v of VertexEccentricity(g, v); PositiveInfinity if g is disconnected.
    library: enumeratio-combinatorics
    type: (value) -> real | signed_infinity
seeAlso:
  - GraphDiameter
  - GraphCenter
  - VertexEccentricity
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: ($1).radius()
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- radius <= diameter <= 2 * radius always holds for a connected graph.
